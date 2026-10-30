"""Two-tone spectrum generation for the simulated RF / IF spectrum analyzer.

Reference planes
----------------
* The **RF** side is referred to the receiver *input*.  Tones are at their
  input powers; intermodulation products are the input-referred equivalents
  (computed from the receiver's cascaded IIP3 / IIP2); the noise floor is
  kTB + NF.
* The **IF** side is referred to the receiver *output*: every RF-side power
  is raised by the total gain G, and frequencies are converted through the
  mixer.

Third-order products (standard small-signal two-tone approximation):

    P(2f1 - f2) = 2*P1 + P2 - 2*IIP3
    P(2f2 - f1) = 2*P2 + P1 - 2*IIP3

which reduces to 3*P - 2*IIP3 for equal tones.  Second-order products, when
an IIP2 is supplied:  P(f1 +/- f2) = P1 + P2 - IIP2.

The analyzer trace is a deterministic rendering: each line is convolved
with a Gaussian resolution-bandwidth filter (3 dB width = RBW) and added in
power to a flat noise floor of kT*RBW + NF.  No random noise is added so
the picture is repeatable and testable.
"""

from __future__ import annotations

import math

import numpy as np

from app.rf.mixer import (
    DEFAULT_LO_IF_ISOLATION_DB,
    DEFAULT_LO_POWER_DBM,
    DEFAULT_LO_RF_ISOLATION_DB,
    convert_frequency,
    im2_frequencies,
    im3_frequencies,
    image_frequency,
    lo_harmonic_suppression_dbc,
    mixer_spur_products,
)
from app.rf.noise import thermal_noise_floor_dbm
from app.rf.units import dbm_to_mw, mw_to_dbm
from app.schemas import (
    SpectrumLine,
    SpectrumRequest,
    SpectrumResponse,
    SpectrumSide,
    SpectrumTrace,
    Warning,
)

TRACE_POINTS = 1601  # classic analyzer sweep length
# The IP3 extrapolation is only trustworthy well below the intercept point.
SMALL_SIGNAL_MARGIN_DB = 10.0


# ---------------------------------------------------------------------------
# Product powers
# ---------------------------------------------------------------------------


def im3_product_powers_dbm(
    p1_dbm: float, p2_dbm: float, iip3_dbm: float
) -> tuple[float, float]:
    """Input-referred IM3 powers at (2f1 - f2, 2f2 - f1) for unequal tones."""
    return (
        2.0 * p1_dbm + p2_dbm - 2.0 * iip3_dbm,
        2.0 * p2_dbm + p1_dbm - 2.0 * iip3_dbm,
    )


def im2_product_power_dbm(p1_dbm: float, p2_dbm: float, iip2_dbm: float) -> float:
    """Input-referred IM2 power at f1 +/- f2."""
    return p1_dbm + p2_dbm - iip2_dbm


# ---------------------------------------------------------------------------
# Analyzer trace
# ---------------------------------------------------------------------------


def analyzer_trace(
    lines: list[SpectrumLine],
    f_min_hz: float,
    f_max_hz: float,
    noise_floor_dbm: float,
    rbw_hz: float,
    num_points: int = TRACE_POINTS,
) -> SpectrumTrace:
    """Render spectral lines through a Gaussian RBW filter onto a flat noise floor."""
    if f_max_hz <= f_min_hz:
        f_max_hz = f_min_hz + max(rbw_hz, 1.0) * 10.0
    grid = np.linspace(f_min_hz, f_max_hz, num_points)
    # Make sure every in-span line frequency is sampled exactly so peaks are
    # not clipped by the grid.
    in_span = [
        ln.frequency_hz for ln in lines if f_min_hz <= ln.frequency_hz <= f_max_hz
    ]
    if in_span:
        grid = np.unique(np.concatenate([grid, np.asarray(in_span)]))

    sigma = rbw_hz / (2.0 * math.sqrt(2.0 * math.log(2.0)))  # 3 dB width = RBW
    power_mw = np.full(grid.shape, dbm_to_mw(noise_floor_dbm))
    for ln in lines:
        if not np.isfinite(ln.power_dbm):
            continue
        # Skip lines far outside the span; their Gaussian tail is negligible.
        if ln.frequency_hz < f_min_hz - 8 * sigma or ln.frequency_hz > f_max_hz + 8 * sigma:
            continue
        power_mw += dbm_to_mw(ln.power_dbm) * np.exp(
            -0.5 * ((grid - ln.frequency_hz) / sigma) ** 2
        )
    powers_dbm = 10.0 * np.log10(power_mw)
    return SpectrumTrace(
        frequencies_hz=grid.tolist(),
        powers_dbm=powers_dbm.tolist(),
        noise_floor_dbm=noise_floor_dbm,
        rbw_hz=rbw_hz,
    )


def _span(core_hz: list[float], rbw_hz: float) -> tuple[float, float]:
    """Plot span around the lines that matter: tones and IM3 products."""
    lo = min(core_hz)
    hi = max(core_hz)
    margin = max(hi - lo, 10.0 * rbw_hz)
    return (max(lo - margin, 0.0), hi + margin)


# ---------------------------------------------------------------------------
# Full spectrum
# ---------------------------------------------------------------------------


def build_spectrum(req: SpectrumRequest) -> SpectrumResponse:
    warnings: list[Warning] = []
    g = req.gain_db
    rbw = req.rbw_hz if req.rbw_hz is not None else req.bandwidth_hz

    # Noise floors.
    noise_in = thermal_noise_floor_dbm(req.bandwidth_hz, req.nf_db, req.temperature_k)
    trace_noise_in = thermal_noise_floor_dbm(rbw, req.nf_db, req.temperature_k)

    # LO parameters (illustrative defaults when omitted).
    lo_power = req.lo_power_dbm if req.lo_power_dbm is not None else DEFAULT_LO_POWER_DBM
    lo_rf_iso = (
        req.lo_rf_isolation_db
        if req.lo_rf_isolation_db is not None
        else DEFAULT_LO_RF_ISOLATION_DB
    )
    lo_if_iso = (
        req.lo_if_isolation_db
        if req.lo_if_isolation_db is not None
        else DEFAULT_LO_IF_ISOLATION_DB
    )
    lo_rf_illustrative = req.lo_power_dbm is None or req.lo_rf_isolation_db is None
    lo_if_illustrative = req.lo_power_dbm is None or req.lo_if_isolation_db is None

    # ---- Frequencies ------------------------------------------------------
    f1, f2 = req.f1_hz, req.f2_hz
    f_im3_lo, f_im3_hi = im3_frequencies(f1, f2)
    if1 = convert_frequency(f1, req.lo_hz, req.sideband)
    if2 = convert_frequency(f2, req.lo_hz, req.sideband)
    if_im3_lo = convert_frequency(f_im3_lo, req.lo_hz, req.sideband)
    if_im3_hi = convert_frequency(f_im3_hi, req.lo_hz, req.sideband)

    # ---- Powers -----------------------------------------------------------
    p_im3_lo, p_im3_hi = im3_product_powers_dbm(req.p1_dbm, req.p2_dbm, req.iip3_dbm)

    # ---- RF side (input-referred) ----------------------------------------
    rf_lines: list[SpectrumLine] = [
        SpectrumLine(frequency_hz=f1, power_dbm=req.p1_dbm, category="desired", label="Tone 1 (f1)"),
        SpectrumLine(frequency_hz=f2, power_dbm=req.p2_dbm, category="desired", label="Tone 2 (f2)"),
        SpectrumLine(frequency_hz=f_im3_lo, power_dbm=p_im3_lo, category="im3", label="IM3: 2f1 - f2"),
        SpectrumLine(frequency_hz=f_im3_hi, power_dbm=p_im3_hi, category="im3", label="IM3: 2f2 - f1"),
    ]
    if_lines: list[SpectrumLine] = [
        SpectrumLine(frequency_hz=if1, power_dbm=req.p1_dbm + g, category="desired", label="Tone 1 at IF"),
        SpectrumLine(frequency_hz=if2, power_dbm=req.p2_dbm + g, category="desired", label="Tone 2 at IF"),
        SpectrumLine(frequency_hz=if_im3_lo, power_dbm=p_im3_lo + g, category="im3", label="IM3 (2f1 - f2) at IF"),
        SpectrumLine(frequency_hz=if_im3_hi, power_dbm=p_im3_hi + g, category="im3", label="IM3 (2f2 - f1) at IF"),
    ]

    if req.iip2_dbm is not None:
        p_im2 = im2_product_power_dbm(req.p1_dbm, req.p2_dbm, req.iip2_dbm)
        rf_diff, rf_sum = im2_frequencies(f1, f2)
        rf_lines += [
            SpectrumLine(frequency_hz=rf_diff, power_dbm=p_im2, category="im2", label="IM2: f2 - f1"),
            SpectrumLine(frequency_hz=rf_sum, power_dbm=p_im2, category="im2", label="IM2: f1 + f2"),
        ]
        if_diff, if_sum = im2_frequencies(if1, if2)
        if_lines += [
            SpectrumLine(frequency_hz=if_diff, power_dbm=p_im2 + g, category="im2", label="IM2 (IF2 - IF1)"),
            SpectrumLine(frequency_hz=if_sum, power_dbm=p_im2 + g, category="im2", label="IM2 (IF1 + IF2)"),
        ]

    # LO leakage out of the RF port (the signal that radiates back toward the
    # antenna).  Reference plane is the mixer RF port, so it is labelled as
    # such and always flagged as an estimate.
    rf_lines.append(
        SpectrumLine(
            frequency_hz=req.lo_hz,
            power_dbm=lo_power - lo_rf_iso,
            category="lo_harmonic",
            label="LO leakage at mixer RF port",
            illustrative=True if lo_rf_illustrative else False,
        )
    )

    # LO feedthrough and harmonics at the IF port.
    for n in range(1, req.mixer_spur_order_max + 1):
        if_lines.append(
            SpectrumLine(
                frequency_hz=n * req.lo_hz,
                power_dbm=lo_power - lo_if_iso - lo_harmonic_suppression_dbc(n),
                category="lo_harmonic",
                label="LO feedthrough at IF" if n == 1 else f"LO harmonic {n}x at IF",
                illustrative=lo_if_illustrative or n > 1,
            )
        )

    # Mixer spurious products (m x RF) +/- (n x LO) for each tone.
    spur_table = (
        {(e.m, e.n): e.suppression_dbc for e in req.spur_table}
        if req.spur_table is not None
        else None
    )
    any_illustrative_spur = False
    if req.include_mixer_spurs:
        for k, (f_rf, p_rf) in enumerate(((f1, req.p1_dbm), (f2, req.p2_dbm)), start=1):
            for sp in mixer_spur_products(
                f_rf, req.lo_hz, req.sideband, req.mixer_spur_order_max, spur_table
            ):
                any_illustrative_spur |= sp.illustrative
                label = f"Tone {k}: {sp.label}"
                if sp.m == 1 and sp.n == 1:
                    label += " (other sideband)"
                if_lines.append(
                    SpectrumLine(
                        frequency_hz=sp.frequency_hz,
                        power_dbm=p_rf + g - sp.suppression_dbc,
                        category="mixer_spur",
                        label=label,
                        illustrative=sp.illustrative,
                    )
                )

    # ---- Spans and traces -------------------------------------------------
    rf_span = _span([f1, f2, f_im3_lo, f_im3_hi], rbw)
    if_span = _span([if1, if2, if_im3_lo, if_im3_hi], rbw)
    for ln in rf_lines:
        ln.in_trace_span = rf_span[0] <= ln.frequency_hz <= rf_span[1]
    for ln in if_lines:
        ln.in_trace_span = if_span[0] <= ln.frequency_hz <= if_span[1]
    rf_lines.sort(key=lambda ln: ln.frequency_hz)
    if_lines.sort(key=lambda ln: ln.frequency_hz)

    rf_trace = analyzer_trace(rf_lines, rf_span[0], rf_span[1], trace_noise_in, rbw)
    if_trace = analyzer_trace(if_lines, if_span[0], if_span[1], trace_noise_in + g, rbw)

    # ---- Warnings ---------------------------------------------------------
    if abs(f1 - f2) < 1e-6:
        warnings.append(
            Warning(
                severity="error",
                message="Both tones are at the same frequency; IM3 products coincide with the tones.",
            )
        )
    p_max = max(req.p1_dbm, req.p2_dbm)
    if p_max > req.iip3_dbm - SMALL_SIGNAL_MARGIN_DB:
        warnings.append(
            Warning(
                severity="warning",
                message=(
                    f"Input tone power ({p_max:.1f} dBm) is within {SMALL_SIGNAL_MARGIN_DB:.0f} dB "
                    f"of IIP3 ({req.iip3_dbm:.1f} dBm).  The 3 dB/dB IP3 extrapolation is a "
                    "small-signal approximation; real IM3 levels near compression differ."
                ),
            )
        )
    for k, f_if in ((1, if1), (2, if2)):
        if f_if <= 0.0:
            warnings.append(
                Warning(
                    severity="warning",
                    message=f"Tone {k} is at the LO frequency and converts to DC.",
                )
            )
    if max(p_im3_lo, p_im3_hi) < noise_in:
        warnings.append(
            Warning(
                severity="info",
                message=(
                    f"Both IM3 products ({p_im3_lo:.1f} / {p_im3_hi:.1f} dBm input-referred) are "
                    f"below the receiver noise floor ({noise_in:.1f} dBm); a real analyzer would "
                    "not resolve them at this bandwidth."
                ),
            )
        )
    img1 = image_frequency(f1, req.lo_hz, req.sideband)
    img2 = image_frequency(f2, req.lo_hz, req.sideband)
    if img1 is not None and img2 is not None:
        warnings.append(
            Warning(
                severity="info",
                message=(
                    f"Image frequencies {img1 / 1e6:.3f} MHz and {img2 / 1e6:.3f} MHz convert to "
                    "the same IF as the tones.  The RF preselect filter must reject the image band."
                ),
            )
        )
    if any_illustrative_spur:
        warnings.append(
            Warning(
                severity="info",
                message=(
                    "Mixer spur levels are illustrative (generic diode-mixer behaviour), not "
                    "measured data.  Supply a spur table to use real values.  Not every "
                    "mathematically possible product appears at a measurable level."
                ),
            )
        )
    out_floor = noise_in + g
    in_band_spurs = [
        ln
        for ln in if_lines
        if ln.category == "mixer_spur" and ln.in_trace_span and ln.power_dbm > out_floor
    ]
    if in_band_spurs:
        worst = max(in_band_spurs, key=lambda ln: ln.power_dbm)
        warnings.append(
            Warning(
                severity="warning",
                message=(
                    f"{len(in_band_spurs)} mixer spur(s) fall inside the plotted IF span above the "
                    f"noise floor; strongest is '{worst.label}' at {worst.frequency_hz / 1e6:.3f} MHz, "
                    f"{worst.power_dbm:.1f} dBm."
                ),
            )
        )

    return SpectrumResponse(
        rf=SpectrumSide(lines=rf_lines, trace=rf_trace, noise_floor_dbm=noise_in),
        if_=SpectrumSide(lines=if_lines, trace=if_trace, noise_floor_dbm=out_floor),
        noise_floor_dbm=noise_in,
        warnings=warnings,
    )
