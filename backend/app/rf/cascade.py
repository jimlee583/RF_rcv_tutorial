"""Receiver cascade analysis.

Implements Friis cascaded noise figure, cascaded gain, cascaded IIP3/OIP3,
plus simple frequency tracking through mixers and band-limit warnings.

All math uses linear units internally (noise factor F, gain ratio G,
IIP3 in milliwatts) and converts back to dB/dBm at the end.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.rf.noise import (
    input_power_for_im3_at_noise_floor_dbm,  # noqa: F401 - re-exported
    mds_dbm,
    sfdr3_db,
    thermal_noise_floor_dbm,
)
from app.rf.units import db_to_lin, dbm_to_mw, lin_to_db, mw_to_dbm
from app.schemas import (
    AttenuatorComponent,
    CascadeResponse,
    CascadeTotals,
    Component,
    FilterComponent,
    MixerComponent,
    StageResult,
    Warning,
)

# ---------------------------------------------------------------------------
# Per-component normalization
# ---------------------------------------------------------------------------


@dataclass
class _NormalizedStage:
    """Component reduced to a cascade-friendly view."""

    id: str
    name: str
    type: str
    gain_db: float  # Negative for passive loss, conversion loss for mixers, etc.
    nf_db: float
    iip3_dbm: float | None
    oip3_dbm: float | None
    ip1db_in_dbm: float | None
    op1db_dbm: float | None
    is_mixer: bool
    lo_hz: float | None
    sideband: str | None
    freq_min_hz: float | None
    freq_max_hz: float | None
    passband_min_hz: float | None
    passband_max_hz: float | None


def _effective_nf_db(nf_user: float | None, insertion_loss_db: float) -> float:
    """Passive NF defaults to the stage's insertion loss (lossless-match assumption).

    If the user specifies an NF below the loss we honor the value but emit a
    warning (handled at the call site).
    """
    if nf_user is None:
        return insertion_loss_db
    return nf_user


def _normalize(c: Component) -> tuple[_NormalizedStage, list[Warning]]:
    warnings: list[Warning] = []
    t = c.type
    if t in ("amplifier", "lna"):
        return (
            _NormalizedStage(
                id=c.id,
                name=c.name or ("LNA" if t == "lna" else "Amplifier"),
                type=t,
                gain_db=c.gain_db,
                nf_db=c.nf_db,
                iip3_dbm=c.iip3_dbm,
                oip3_dbm=c.oip3_dbm,
                ip1db_in_dbm=c.ip1db_in_dbm,
                op1db_dbm=c.op1db_dbm,
                is_mixer=False,
                lo_hz=None,
                sideband=None,
                freq_min_hz=c.freq_min_hz,
                freq_max_hz=c.freq_max_hz,
                passband_min_hz=None,
                passband_max_hz=None,
            ),
            warnings,
        )
    if isinstance(c, FilterComponent):
        loss = c.insertion_loss_db
        nf = _effective_nf_db(c.nf_db, loss)
        if c.nf_db is not None and c.nf_db < loss - 1e-6:
            warnings.append(
                Warning(
                    severity="warning",
                    message=(
                        f"Filter '{c.name or c.id}' has NF ({c.nf_db:.2f} dB) below its "
                        f"insertion loss ({loss:.2f} dB).  For a passive, lossy, matched "
                        "component NF equals the loss; the user value overrides the model."
                    ),
                    stage_id=c.id,
                )
            )
        return (
            _NormalizedStage(
                id=c.id,
                name=c.name or "Filter",
                type="filter",
                gain_db=-loss,
                nf_db=nf,
                iip3_dbm=None,
                oip3_dbm=None,
                ip1db_in_dbm=None,
                op1db_dbm=None,
                is_mixer=False,
                lo_hz=None,
                sideband=None,
                freq_min_hz=c.freq_min_hz or c.passband_min_hz,
                freq_max_hz=c.freq_max_hz or c.passband_max_hz,
                passband_min_hz=c.passband_min_hz,
                passband_max_hz=c.passband_max_hz,
            ),
            warnings,
        )
    if isinstance(c, AttenuatorComponent):
        loss = c.attenuation_db
        nf = _effective_nf_db(c.nf_db, loss)
        if c.nf_db is not None and c.nf_db < loss - 1e-6:
            warnings.append(
                Warning(
                    severity="warning",
                    message=(
                        f"Attenuator '{c.name or c.id}' NF ({c.nf_db:.2f} dB) is less "
                        f"than its attenuation ({loss:.2f} dB)."
                    ),
                    stage_id=c.id,
                )
            )
        return (
            _NormalizedStage(
                id=c.id,
                name=c.name or "Attenuator",
                type="attenuator",
                gain_db=-loss,
                nf_db=nf,
                iip3_dbm=None,
                oip3_dbm=None,
                ip1db_in_dbm=None,
                op1db_dbm=None,
                is_mixer=False,
                lo_hz=None,
                sideband=None,
                freq_min_hz=c.freq_min_hz,
                freq_max_hz=c.freq_max_hz,
                passband_min_hz=None,
                passband_max_hz=None,
            ),
            warnings,
        )
    if isinstance(c, MixerComponent):
        return (
            _NormalizedStage(
                id=c.id,
                name=c.name or "Mixer",
                type="mixer",
                gain_db=c.conversion_gain_db,
                nf_db=c.nf_db,
                iip3_dbm=c.iip3_dbm,
                oip3_dbm=c.oip3_dbm,
                ip1db_in_dbm=c.ip1db_in_dbm,
                op1db_dbm=c.op1db_dbm,
                is_mixer=True,
                lo_hz=c.lo_frequency_hz,
                sideband=c.sideband,
                freq_min_hz=c.freq_min_hz,
                freq_max_hz=c.freq_max_hz,
                passband_min_hz=None,
                passband_max_hz=None,
            ),
            warnings,
        )
    raise ValueError(f"Unknown component type: {type(c)!r}")


def _resolved_iip3_dbm(stage: _NormalizedStage) -> float | None:
    """Pick IIP3 directly, or derive from OIP3 if only OIP3 is given."""
    if stage.iip3_dbm is not None:
        return stage.iip3_dbm
    if stage.oip3_dbm is not None:
        return stage.oip3_dbm - stage.gain_db
    return None


def _resolved_ip1db_in_dbm(stage: _NormalizedStage) -> float | None:
    if stage.ip1db_in_dbm is not None:
        return stage.ip1db_in_dbm
    if stage.op1db_dbm is not None:
        return stage.op1db_dbm - stage.gain_db
    return None


# ---------------------------------------------------------------------------
# Cascade core
# ---------------------------------------------------------------------------


def friis_total_nf_db(nfs_db: list[float], gains_db: list[float]) -> float:
    """Cascaded noise figure (dB) via Friis.

    F_total = F1 + (F2 - 1)/G1 + (F3 - 1)/(G1*G2) + ...
    """
    if not nfs_db:
        return 0.0
    gains_lin = [db_to_lin(g) for g in gains_db]
    factors = [db_to_lin(nf) for nf in nfs_db]
    total = factors[0]
    product_prev = 1.0
    for i in range(1, len(factors)):
        product_prev *= gains_lin[i - 1]
        total += (factors[i] - 1.0) / product_prev
    return lin_to_db(total)


def total_gain_db(gains_db: list[float]) -> float:
    return float(sum(gains_db))


def cascaded_iip3_dbm(
    iip3s_dbm: list[float | None], gains_db: list[float]
) -> float | None:
    """Cascaded input-referred IP3 in dBm.

    Using small-signal addition of in-band third-order products in power
    (coherent-worst-case / standard cascade formula):

        1 / IIP3_total_mw = sum_i ( G_prev_i / IIP3_i_mw )

    where G_prev_i is the linear voltage/power gain preceding stage i.
    Stages with ``None`` IIP3 are treated as ideally linear and contribute
    nothing to the sum.
    """
    if not iip3s_dbm:
        return None
    gains_lin = [db_to_lin(g) for g in gains_db]
    inv_sum = 0.0
    product_prev = 1.0
    any_contribution = False
    for i, iip3 in enumerate(iip3s_dbm):
        if i > 0:
            product_prev *= gains_lin[i - 1]
        if iip3 is None:
            continue
        iip3_mw = dbm_to_mw(iip3)
        if iip3_mw <= 0:
            continue
        inv_sum += product_prev / iip3_mw
        any_contribution = True
    if not any_contribution or inv_sum <= 0:
        return None
    return mw_to_dbm(1.0 / inv_sum)


def cascaded_oip3_dbm(
    iip3s_dbm: list[float | None], gains_db: list[float]
) -> float | None:
    """Output-referred IP3: OIP3_total = IIP3_total + G_total."""
    iip3_tot = cascaded_iip3_dbm(iip3s_dbm, gains_db)
    if iip3_tot is None:
        return None
    return iip3_tot + total_gain_db(gains_db)


# ---------------------------------------------------------------------------
# Frequency tracking
# ---------------------------------------------------------------------------


def _mixer_output_frequency(f_in_hz: float, lo_hz: float, sideband: str) -> float:
    if sideband == "upper":
        return f_in_hz + lo_hz
    # lower sideband (standard downconversion)
    return abs(f_in_hz - lo_hz)


# ---------------------------------------------------------------------------
# Full analysis
# ---------------------------------------------------------------------------


def analyze(
    components: list[Component],
    bandwidth_hz: float,
    temperature_k: float = 290.0,
    source_frequency_hz: float | None = None,
) -> CascadeResponse:
    warnings: list[Warning] = []
    normalized: list[_NormalizedStage] = []
    for c in components:
        stage, w = _normalize(c)
        warnings.extend(w)
        normalized.append(stage)

    gains_db = [s.gain_db for s in normalized]
    nfs_db = [s.nf_db for s in normalized]
    iip3s = [_resolved_iip3_dbm(s) for s in normalized]

    # Cumulative stage results.
    stages: list[StageResult] = []
    cum_gain = 0.0
    freq_in = source_frequency_hz
    for i, s in enumerate(normalized):
        # Band warning (checked on the input frequency to this stage).
        if freq_in is not None:
            lo_edge = s.freq_min_hz
            hi_edge = s.freq_max_hz
            if lo_edge is not None and freq_in < lo_edge - 1e-3:
                warnings.append(
                    Warning(
                        severity="warning",
                        message=(
                            f"Signal at {freq_in / 1e6:.3f} MHz is below '{s.name}' "
                            f"band ({lo_edge / 1e6:.3f} MHz)."
                        ),
                        stage_id=s.id,
                    )
                )
            if hi_edge is not None and freq_in > hi_edge + 1e-3:
                warnings.append(
                    Warning(
                        severity="warning",
                        message=(
                            f"Signal at {freq_in / 1e6:.3f} MHz is above '{s.name}' "
                            f"band ({hi_edge / 1e6:.3f} MHz)."
                        ),
                        stage_id=s.id,
                    )
                )
            if s.passband_min_hz is not None and freq_in < s.passband_min_hz - 1e-3:
                warnings.append(
                    Warning(
                        severity="warning",
                        message=(
                            f"Signal at {freq_in / 1e6:.3f} MHz is below filter "
                            f"'{s.name}' passband ({s.passband_min_hz / 1e6:.3f} MHz)."
                        ),
                        stage_id=s.id,
                    )
                )
            if s.passband_max_hz is not None and freq_in > s.passband_max_hz + 1e-3:
                warnings.append(
                    Warning(
                        severity="warning",
                        message=(
                            f"Signal at {freq_in / 1e6:.3f} MHz is above filter "
                            f"'{s.name}' passband ({s.passband_max_hz / 1e6:.3f} MHz)."
                        ),
                        stage_id=s.id,
                    )
                )

        # Compute per-stage cumulative values up through stage i.
        gains_up_to_here = gains_db[: i + 1]
        nfs_up_to_here = nfs_db[: i + 1]
        iip3s_up_to_here = iip3s[: i + 1]
        cum_gain = total_gain_db(gains_up_to_here)
        cum_nf = friis_total_nf_db(nfs_up_to_here, gains_up_to_here)
        cum_iip3 = cascaded_iip3_dbm(iip3s_up_to_here, gains_up_to_here)
        cum_oip3 = (cum_iip3 + cum_gain) if cum_iip3 is not None else None

        # NF contribution of this stage to the total cumulative NF.
        if i == 0:
            prev_nf = 0.0
        else:
            prev_nf = friis_total_nf_db(nfs_up_to_here[:-1], gains_up_to_here[:-1])
        nf_contribution = cum_nf - prev_nf

        # Frequency out of this stage.
        freq_out: float | None
        if s.is_mixer and freq_in is not None and s.lo_hz is not None:
            freq_out = _mixer_output_frequency(freq_in, s.lo_hz, s.sideband or "lower")
        else:
            freq_out = freq_in

        stages.append(
            StageResult(
                index=i,
                id=s.id,
                name=s.name,
                type=s.type,
                gain_db=s.gain_db,
                nf_db=s.nf_db,
                iip3_dbm=_resolved_iip3_dbm(s),
                oip3_dbm=(
                    _resolved_iip3_dbm(s) + s.gain_db
                    if _resolved_iip3_dbm(s) is not None
                    else None
                ),
                cumulative_gain_db=cum_gain,
                cumulative_nf_db=cum_nf,
                cumulative_iip3_dbm=cum_iip3,
                cumulative_oip3_dbm=cum_oip3,
                frequency_in_hz=freq_in,
                frequency_out_hz=freq_out,
                nf_contribution_db=nf_contribution,
            )
        )
        freq_in = freq_out

    total_g = total_gain_db(gains_db)
    total_nf = friis_total_nf_db(nfs_db, gains_db) if nfs_db else 0.0
    total_iip3 = cascaded_iip3_dbm(iip3s, gains_db)
    total_oip3 = (total_iip3 + total_g) if total_iip3 is not None else None
    noise_floor = thermal_noise_floor_dbm(bandwidth_hz, total_nf, temperature_k)
    sfdr = sfdr3_db(total_iip3, noise_floor) if total_iip3 is not None else None

    # Input compression estimate: minimum over stages of (OP1dB_i - G_cum,i).
    input_p1db_estimate: float | None = None
    limiting_id: str | None = None
    cum_gain_through = 0.0
    for s in normalized:
        cum_gain_through += s.gain_db
        op1db = s.op1db_dbm
        if op1db is None and s.ip1db_in_dbm is not None:
            op1db = s.ip1db_in_dbm + s.gain_db
        if op1db is None:
            continue
        input_referred = op1db - cum_gain_through
        if input_p1db_estimate is None or input_referred < input_p1db_estimate:
            input_p1db_estimate = input_referred
            limiting_id = s.id

    compression_dr = (
        (input_p1db_estimate - noise_floor) if input_p1db_estimate is not None else None
    )

    totals = CascadeTotals(
        gain_db=total_g,
        nf_db=total_nf,
        iip3_dbm=total_iip3,
        oip3_dbm=total_oip3,
        noise_floor_dbm=noise_floor,
        sfdr3_db=sfdr,
        compression_dr_db=compression_dr,
        input_p1db_estimate_dbm=input_p1db_estimate,
        input_p1db_limiting_stage_id=limiting_id,
        mds_dbm=mds_dbm(noise_floor, 0.0),
        bandwidth_hz=bandwidth_hz,
        temperature_k=temperature_k,
    )

    return CascadeResponse(stages=stages, totals=totals, warnings=warnings)
