"""Jammer impact on a receiver.

A jammer is modelled at the receiver *input* (antenna side) and then
routed through the lab's existing cascade quantities:

* a brick-wall preselect (first filter's passband + stopband rejection),
* the cascaded noise floor ``N = kTB + NF``,
* the cascaded IIP3 (for CW two-tone IM3 products), and
* the input P1dB estimate (for compression and AGC backoff).

Two jammer kinds are supported:

* ``noise`` - a flat-top (rectangular) spectrum of total power ``p_dbm``
  over a user-set bandwidth centered at ``f_center_hz``.  The portion that
  falls inside the receiver channel ``B`` raises the effective floor; the
  entire (post-preselect) power is what the LNA sees.
* ``cw`` - one CW tone, optionally with a second tone so that a
  ``2 f1 - f2`` or ``2 f2 - f1`` third-order product can land on the
  desired frequency.

Every power is input-referred (antenna reference plane).  Nothing in this
module tries to model the analog filter skirt or the demodulator; it
exposes the same small-signal quantities the rest of the lab uses and
reports the one AGC trade (pad A dB in front of the LNA restores
linearity, raises NF by A, and leaves the in-channel C/I alone because
pad attenuates signal and jammer equally).
"""

from __future__ import annotations

import math

from app.rf.noise import thermal_noise_floor_dbm
from app.rf.spectrum import im3_product_powers_dbm
from app.rf.units import dbm_to_mw, mw_to_dbm
from app.schemas import (
    JammerCwTone,
    JammerIm3Product,
    JammerRequest,
    JammerResponse,
    JammerScenario,
    Warning,
)

# ---------------------------------------------------------------------------
# Preselect
# ---------------------------------------------------------------------------


def preselect_attenuation_db(
    center_hz: float,
    passband_min_hz: float | None,
    passband_max_hz: float | None,
    stopband_rejection_db: float | None,
) -> float:
    """Extra attenuation applied by the preselect to a tone at ``center_hz``.

    In the passband the extra attenuation is 0 (the filter's own insertion
    loss is already baked into the cascade's IIP3 / P1dB / NF numbers).
    Outside the passband the tone is reduced by ``stopband_rejection_db``.
    Missing passband edges or a missing rejection count as 0 dB.
    """
    if passband_min_hz is None or passband_max_hz is None:
        return 0.0
    if passband_min_hz <= center_hz <= passband_max_hz:
        return 0.0
    if stopband_rejection_db is None:
        return 0.0
    return float(stopband_rejection_db)


def _overlap_hz(
    center_a: float, bw_a: float, center_b: float, bw_b: float
) -> float:
    """Length of the overlap of two rectangular bands, in hertz."""
    lo_a, hi_a = center_a - bw_a * 0.5, center_a + bw_a * 0.5
    lo_b, hi_b = center_b - bw_b * 0.5, center_b + bw_b * 0.5
    return max(0.0, min(hi_a, hi_b) - max(lo_a, lo_b))


def noise_jammer_in_channel_dbm(
    p_dbm: float,
    jammer_bw_hz: float,
    jammer_center_hz: float,
    desired_hz: float,
    receiver_bw_hz: float,
) -> float:
    """Portion of a flat noise jammer that falls inside the receiver channel.

    Returns ``-inf`` when the two rectangles do not overlap at all.
    """
    if jammer_bw_hz <= 0 or receiver_bw_hz <= 0:
        return float("-inf")
    overlap = _overlap_hz(
        jammer_center_hz, jammer_bw_hz, desired_hz, receiver_bw_hz
    )
    if overlap <= 0.0:
        return float("-inf")
    fraction = overlap / jammer_bw_hz
    return p_dbm + 10.0 * math.log10(fraction)


# ---------------------------------------------------------------------------
# Power sums
# ---------------------------------------------------------------------------


def power_sum_dbm(values_dbm: list[float]) -> float:
    """Coherent power sum of several dBm quantities (treat each as mW)."""
    total_mw = 0.0
    for v in values_dbm:
        if math.isfinite(v):
            total_mw += dbm_to_mw(v)
    if total_mw <= 0.0:
        return float("-inf")
    return mw_to_dbm(total_mw)


# ---------------------------------------------------------------------------
# AGC pad
# ---------------------------------------------------------------------------


def agc_pad_db(
    front_end_power_dbm: float,
    input_p1db_dbm: float | None,
    backoff_db: float,
) -> float:
    """Required input attenuation so front-end power sits ``backoff_db`` under P1dB.

    Zero when the front end is already below the backoff target, or when
    there is no P1dB estimate to protect against.
    """
    if input_p1db_dbm is None:
        return 0.0
    target = input_p1db_dbm - backoff_db
    return max(0.0, front_end_power_dbm - target)


# ---------------------------------------------------------------------------
# Scenario builder (one of {AGC off, AGC on})
# ---------------------------------------------------------------------------


def _im3_products(
    tones: list[JammerCwTone],
    iip3_dbm: float,
) -> list[JammerIm3Product]:
    """All equal-tone and unequal-tone IM3 products from a list of CW tones.

    One tone: no IM3.  Two tones: the standard ``2 f1 - f2`` and
    ``2 f2 - f1`` pair.  (No higher-order combinations; the tab is a demo,
    not a spur calculator.)
    """
    if len(tones) < 2:
        return []
    f1, f2 = tones[0].f_hz, tones[1].f_hz
    p1, p2 = tones[0].p_dbm, tones[1].p_dbm
    # P(2f1 - f2) = 2 p1 + p2 - 2 IIP3, and symmetric.
    p_lo, p_hi = im3_product_powers_dbm(p1, p2, iip3_dbm)
    return [
        JammerIm3Product(
            frequency_hz=2.0 * f1 - f2,
            power_dbm=p_lo,
            label="2 f1 - f2",
        ),
        JammerIm3Product(
            frequency_hz=2.0 * f2 - f1,
            power_dbm=p_hi,
            label="2 f2 - f1",
        ),
    ]


def _bin_contains(center_hz: float, bin_center_hz: float, bin_bw_hz: float) -> bool:
    half = bin_bw_hz * 0.5
    return (bin_center_hz - half) <= center_hz <= (bin_center_hz + half)


def build_scenario(
    *,
    label: str,
    agc_on: bool,
    req: JammerRequest,
    attenuated_cw_tones: list[JammerCwTone],
    noise_in_band_dbm: float,
    noise_front_end_dbm: float,
    thermal_floor_dbm: float,
) -> JammerScenario:
    """Compute one AGC column (either 'off' = pad=0 or 'on' = pad sized).

    All inputs already have preselect attenuation applied.  The function
    picks the pad, derives post-pad versions of every quantity, and
    returns the user-visible numbers.
    """
    # CW front-end power (sum of CW tones), pre-pad.
    cw_front_dbm = (
        power_sum_dbm([t.p_dbm for t in attenuated_cw_tones])
        if attenuated_cw_tones
        else float("-inf")
    )
    # Total front-end power at the first compressing stage, pre-pad.
    front_end_dbm = power_sum_dbm([cw_front_dbm, noise_front_end_dbm])

    # AGC pad sizing.
    if agc_on:
        pad_db = agc_pad_db(front_end_dbm, req.input_p1db_dbm, req.agc_backoff_db)
    else:
        pad_db = 0.0

    # Post-pad quantities.  The pad attenuates every input-referred power
    # by `pad_db`, raises NF by `pad_db`, and raises the input-referred
    # IIP3 and P1dB by `pad_db`.
    eff_nf_db = req.nf_db + pad_db
    eff_iip3_dbm = req.iip3_dbm + pad_db
    eff_p1db_dbm = (
        req.input_p1db_dbm + pad_db if req.input_p1db_dbm is not None else None
    )

    # Thermal floor with the degraded NF.
    thermal_after_pad = thermal_noise_floor_dbm(
        req.bandwidth_hz, eff_nf_db, req.temperature_k
    )

    # In-channel noise jammer slice, after pad.
    noise_in_band_after = (
        noise_in_band_dbm - pad_db if math.isfinite(noise_in_band_dbm) else float("-inf")
    )

    # CW tones + IM3, after pad.
    cw_after = [
        JammerCwTone(f_hz=t.f_hz, p_dbm=t.p_dbm - pad_db)
        for t in attenuated_cw_tones
    ]
    im3 = _im3_products(cw_after, eff_iip3_dbm)
    # Tag IM3 validity: below P1dB the small-signal cubic law holds; at
    # or above P1dB it is a sketch.
    cw_front_after = (
        power_sum_dbm([t.p_dbm for t in cw_after]) if cw_after else float("-inf")
    )
    cw_im3_valid = (
        eff_p1db_dbm is None or cw_front_after < eff_p1db_dbm
    )
    for p in im3:
        p.valid = cw_im3_valid

    # What lands inside the receiver channel ``B``: in-channel noise
    # slice, any CW tone inside ``B``, and any IM3 product inside ``B``.
    in_channel_terms: list[float] = []
    if math.isfinite(noise_in_band_after):
        in_channel_terms.append(noise_in_band_after)
    for t in cw_after:
        if _bin_contains(t.f_hz, req.desired_f_hz, req.bandwidth_hz):
            in_channel_terms.append(t.p_dbm)
    for p in im3:
        if _bin_contains(p.frequency_hz, req.desired_f_hz, req.bandwidth_hz):
            in_channel_terms.append(p.power_dbm)
    jammer_in_channel_dbm = power_sum_dbm(in_channel_terms)

    # Effective in-channel floor = thermal + any in-channel jammer power.
    if math.isfinite(jammer_in_channel_dbm):
        effective_floor_dbm = power_sum_dbm(
            [thermal_after_pad, jammer_in_channel_dbm]
        )
    else:
        effective_floor_dbm = thermal_after_pad

    # Desired signal power after the pad (pad attenuates desired too).
    desired_after_dbm = req.desired_p_dbm - pad_db
    snr_db = desired_after_dbm - effective_floor_dbm
    snr_margin_db = snr_db - req.required_snr_db

    # Front-end power after the pad.
    front_end_after_dbm = (
        front_end_dbm - pad_db if math.isfinite(front_end_dbm) else float("-inf")
    )
    # Headroom to P1dB after pad (positive = under P1dB).
    headroom_db = (
        (eff_p1db_dbm - front_end_after_dbm)
        if (eff_p1db_dbm is not None and math.isfinite(front_end_after_dbm))
        else None
    )
    # Compression is only a "sketch" model; flag when front end >= P1dB.
    compressing = (
        eff_p1db_dbm is not None
        and math.isfinite(front_end_after_dbm)
        and front_end_after_dbm >= eff_p1db_dbm
    )
    # Gain-reduction sketch: 1 dB at P1dB, then dB-for-dB over it.
    if compressing:
        gain_reduction_db = 1.0 + max(
            0.0, front_end_after_dbm - (eff_p1db_dbm or 0.0)
        )
    else:
        gain_reduction_db = 0.0

    return JammerScenario(
        label=label,
        agc_on=agc_on,
        pad_db=pad_db,
        nf_db=eff_nf_db,
        iip3_dbm=eff_iip3_dbm,
        input_p1db_dbm=eff_p1db_dbm,
        thermal_floor_dbm=thermal_after_pad,
        jammer_in_channel_dbm=jammer_in_channel_dbm,
        effective_floor_dbm=effective_floor_dbm,
        desired_power_dbm=desired_after_dbm,
        snr_db=snr_db,
        snr_margin_db=snr_margin_db,
        front_end_power_dbm=front_end_after_dbm,
        p1db_headroom_db=headroom_db,
        compressing=compressing,
        gain_reduction_db=gain_reduction_db,
        cw_tones=cw_after,
        im3_products=im3,
        im3_valid=cw_im3_valid,
    )


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------


def build_jammer(req: JammerRequest) -> JammerResponse:
    warnings: list[Warning] = []

    # ---- Preselect: apply once to every antenna-referred jammer power ----
    noise_atten_db = 0.0
    if req.noise is not None:
        noise_atten_db = preselect_attenuation_db(
            req.noise.f_center_hz,
            req.preselect_passband_min_hz,
            req.preselect_passband_max_hz,
            req.preselect_stopband_rejection_db,
        )
    cw_tones_in: list[JammerCwTone] = []
    for t in req.cw_tones or []:
        atten = preselect_attenuation_db(
            t.f_hz,
            req.preselect_passband_min_hz,
            req.preselect_passband_max_hz,
            req.preselect_stopband_rejection_db,
        )
        cw_tones_in.append(JammerCwTone(f_hz=t.f_hz, p_dbm=t.p_dbm - atten))

    # ---- Noise jammer: total (front end) vs in-channel slice -----------
    if req.noise is not None:
        noise_front_dbm = req.noise.p_dbm - noise_atten_db
        noise_in_band_raw = noise_jammer_in_channel_dbm(
            req.noise.p_dbm,
            req.noise.bandwidth_hz,
            req.noise.f_center_hz,
            req.desired_f_hz,
            req.bandwidth_hz,
        )
        noise_in_band_dbm = (
            noise_in_band_raw - noise_atten_db
            if math.isfinite(noise_in_band_raw)
            else float("-inf")
        )
    else:
        noise_front_dbm = float("-inf")
        noise_in_band_dbm = float("-inf")

    thermal_floor_dbm = thermal_noise_floor_dbm(
        req.bandwidth_hz, req.nf_db, req.temperature_k
    )

    # ---- Warnings -------------------------------------------------------
    if (
        req.preselect_passband_min_hz is None
        or req.preselect_passband_max_hz is None
    ):
        warnings.append(
            Warning(
                severity="info",
                message=(
                    "No preselect passband set: jammers reach the LNA at their "
                    "antenna power.  Set a passband (and stopband rejection) to "
                    "see the filter's effect."
                ),
            )
        )
    elif req.preselect_stopband_rejection_db is None:
        warnings.append(
            Warning(
                severity="info",
                message=(
                    "No preselect stopband rejection set: out-of-band jammers "
                    "are treated as if the filter were absent."
                ),
            )
        )

    if req.input_p1db_dbm is None:
        warnings.append(
            Warning(
                severity="warning",
                message=(
                    "No cascaded input P1dB supplied; compression and AGC are "
                    "skipped.  Only the noise-floor and IM3 views are shown."
                ),
            )
        )

    # Noise bandwidth that straddles the preselect edge is approximated.
    if req.noise is not None and (
        req.preselect_passband_min_hz is not None
        and req.preselect_passband_max_hz is not None
    ):
        n_lo = req.noise.f_center_hz - 0.5 * req.noise.bandwidth_hz
        n_hi = req.noise.f_center_hz + 0.5 * req.noise.bandwidth_hz
        straddles = (
            (n_lo < req.preselect_passband_min_hz < n_hi)
            or (n_lo < req.preselect_passband_max_hz < n_hi)
        )
        if straddles:
            warnings.append(
                Warning(
                    severity="info",
                    message=(
                        "Noise jammer straddles the preselect edge.  This lab "
                        "applies a single rejection value based on the jammer's "
                        "center frequency, which is a brick-wall approximation."
                    ),
                )
            )

    if not cw_tones_in and req.noise is None:
        warnings.append(
            Warning(
                severity="info",
                message="No jammer defined; the numbers show the clean-link case.",
            )
        )

    # ---- Two scenarios --------------------------------------------------
    off = build_scenario(
        label="AGC off",
        agc_on=False,
        req=req,
        attenuated_cw_tones=cw_tones_in,
        noise_in_band_dbm=noise_in_band_dbm,
        noise_front_end_dbm=noise_front_dbm,
        thermal_floor_dbm=thermal_floor_dbm,
    )
    on = (
        build_scenario(
            label="AGC on",
            agc_on=True,
            req=req,
            attenuated_cw_tones=cw_tones_in,
            noise_in_band_dbm=noise_in_band_dbm,
            noise_front_end_dbm=noise_front_dbm,
            thermal_floor_dbm=thermal_floor_dbm,
        )
        if req.input_p1db_dbm is not None
        else None
    )

    if off.compressing:
        warnings.append(
            Warning(
                severity="warning",
                message=(
                    "Front-end power is at or above input P1dB.  The gain "
                    "reduction shown is a labelled sketch, not a device model; "
                    "the small-signal IM3 extrapolation is invalid in this region."
                ),
            )
        )

    return JammerResponse(
        scenario_off=off,
        scenario_on=on,
        thermal_floor_dbm=thermal_floor_dbm,
        preselect_attenuation_db_noise=noise_atten_db,
        warnings=warnings,
    )
