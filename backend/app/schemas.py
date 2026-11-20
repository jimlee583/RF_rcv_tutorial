"""Pydantic request/response schemas for the RF Receiver Lab API.

Component types form a tagged union on the ``type`` field so the frontend
sends and receives one unambiguous shape per component.  All parameters
use the engineering conventions:

* Gain / insertion loss / NF in dB (positive loss represented as a positive
  ``insertion_loss_db`` for passive parts, or a negative ``gain_db`` for
  active parts that attenuate).
* Power quantities (IIP3, OIP3, IP1dB_in, OP1dB) in dBm.
* Frequencies in Hz.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ---------------------------------------------------------------------------
# Component definitions (tagged union on ``type``)
# ---------------------------------------------------------------------------


class _BaseComponent(BaseModel):
    """Shared fields.  ``id`` is a stable client-generated identifier."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str = ""
    freq_min_hz: float | None = Field(
        default=None, description="Lower edge of operating band (Hz)."
    )
    freq_max_hz: float | None = Field(
        default=None, description="Upper edge of operating band (Hz)."
    )
    notes: str = ""


class AmplifierComponent(_BaseComponent):
    type: Literal["amplifier"] = "amplifier"
    gain_db: float
    nf_db: float
    iip3_dbm: float | None = None
    oip3_dbm: float | None = None
    ip1db_in_dbm: float | None = None
    op1db_dbm: float | None = None

    @model_validator(mode="after")
    def _check_ip3(self) -> "AmplifierComponent":
        # Allow either IIP3 or OIP3 (or neither = ideal linear).
        return self


class LnaComponent(_BaseComponent):
    """A low-noise amplifier.  Mathematically identical to Amplifier;
    distinct type lets the UI style it and set friendlier defaults."""

    type: Literal["lna"] = "lna"
    gain_db: float
    nf_db: float
    iip3_dbm: float | None = None
    oip3_dbm: float | None = None
    ip1db_in_dbm: float | None = None
    op1db_dbm: float | None = None


class FilterComponent(_BaseComponent):
    type: Literal["filter"] = "filter"
    insertion_loss_db: float = Field(ge=0)
    passband_min_hz: float | None = None
    passband_max_hz: float | None = None
    stopband_rejection_db: float | None = None
    # NF for a passive filter defaults to its insertion loss.
    nf_db: float | None = None


class AttenuatorComponent(_BaseComponent):
    type: Literal["attenuator"] = "attenuator"
    attenuation_db: float = Field(ge=0)
    nf_db: float | None = None  # defaults to attenuation_db


class MixerComponent(_BaseComponent):
    type: Literal["mixer"] = "mixer"
    # Conversion gain (negative for passive mixers).
    conversion_gain_db: float
    nf_db: float
    iip3_dbm: float | None = None
    oip3_dbm: float | None = None
    ip1db_in_dbm: float | None = None
    op1db_dbm: float | None = None
    lo_frequency_hz: float
    sideband: Literal["lower", "upper"] = "lower"
    lo_power_dbm: float | None = None
    lo_rf_isolation_db: float | None = None


Component = Annotated[
    AmplifierComponent
    | LnaComponent
    | FilterComponent
    | AttenuatorComponent
    | MixerComponent,
    Field(discriminator="type"),
]


# ---------------------------------------------------------------------------
# Analysis request / response
# ---------------------------------------------------------------------------


class CascadeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    components: list[Component]
    bandwidth_hz: float = Field(gt=0, description="Receiver noise bandwidth (Hz).")
    temperature_k: float = Field(default=290.0, gt=0)
    source_frequency_hz: float | None = Field(
        default=None,
        description=(
            "Center frequency of the desired signal at the receiver input, Hz. "
            "Used for frequency tracking through mixers and band warnings."
        ),
    )


class StageResult(BaseModel):
    index: int
    id: str
    name: str
    type: str
    gain_db: float
    nf_db: float
    iip3_dbm: float | None
    oip3_dbm: float | None
    cumulative_gain_db: float
    cumulative_nf_db: float
    cumulative_iip3_dbm: float | None
    cumulative_oip3_dbm: float | None
    frequency_in_hz: float | None
    frequency_out_hz: float | None
    nf_contribution_db: float = Field(
        description=(
            "This stage's contribution to the total cascaded NF, in dB. "
            "Sum of all stages' contributions equals the total cumulative NF."
        )
    )


class CascadeTotals(BaseModel):
    gain_db: float
    nf_db: float
    iip3_dbm: float | None
    oip3_dbm: float | None
    noise_floor_dbm: float
    sfdr3_db: float | None
    compression_dr_db: float | None = Field(
        default=None,
        description=(
            "Estimated input compression dynamic range: input P1dB (estimate) "
            "minus noise floor.  Only populated when at least one stage has P1dB."
        ),
    )
    input_p1db_estimate_dbm: float | None = None
    input_p1db_limiting_stage_id: str | None = None
    mds_dbm: float
    bandwidth_hz: float
    temperature_k: float


class Warning(BaseModel):
    severity: Literal["info", "warning", "error"]
    message: str
    stage_id: str | None = None


class CascadeResponse(BaseModel):
    stages: list[StageResult]
    totals: CascadeTotals
    warnings: list[Warning]


# ---------------------------------------------------------------------------
# Receiver config (save/load)
# ---------------------------------------------------------------------------


class ReceiverConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = "Default receiver"
    description: str = ""
    components: list[Component]
    bandwidth_hz: float = Field(gt=0, default=1_000_000.0)
    temperature_k: float = Field(gt=0, default=290.0)
    source_frequency_hz: float | None = 2.1e9
    illustrative: bool = Field(
        default=True,
        description=(
            "Indicates this is an illustrative/example configuration, not a "
            "specification of real hardware."
        ),
    )


# ---------------------------------------------------------------------------
# Spectrum (Phase 2)
# ---------------------------------------------------------------------------


class MixerSpurEntry(BaseModel):
    """One row of a measured mixer spur table.

    ``suppression_dbc`` is how far the (m x RF) +/- (n x LO) product sits
    below the desired (1 x RF) +/- (1 x LO) output, in dB.
    """

    model_config = ConfigDict(extra="forbid")

    m: int = Field(ge=0, description="RF harmonic order.")
    n: int = Field(ge=0, description="LO harmonic order.")
    suppression_dbc: float


class SpectrumRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    f1_hz: float = Field(gt=0)
    f2_hz: float = Field(gt=0)
    p1_dbm: float
    p2_dbm: float
    lo_hz: float = Field(gt=0)
    sideband: Literal["lower", "upper"] = "lower"
    iip3_dbm: float
    iip2_dbm: float | None = None
    gain_db: float = 0.0
    nf_db: float = 0.0
    bandwidth_hz: float = Field(gt=0, default=1_000_000.0)
    temperature_k: float = Field(gt=0, default=290.0)
    rbw_hz: float | None = Field(
        default=None,
        gt=0,
        description=(
            "Resolution bandwidth for the simulated analyzer trace (Hz).  "
            "Defaults to the receiver bandwidth so the trace noise floor matches "
            "the receiver noise floor."
        ),
    )
    include_mixer_spurs: bool = True
    mixer_spur_order_max: int = Field(default=3, ge=1, le=7)
    lo_power_dbm: float | None = Field(
        default=None,
        description="LO drive level.  If omitted an illustrative +7 dBm is used.",
    )
    lo_rf_isolation_db: float | None = Field(
        default=None,
        ge=0,
        description="LO-to-RF port isolation.  Illustrative default if omitted.",
    )
    lo_if_isolation_db: float | None = Field(
        default=None,
        ge=0,
        description="LO-to-IF port isolation.  Illustrative default if omitted.",
    )
    spur_table: list[MixerSpurEntry] | None = Field(
        default=None,
        description=(
            "Measured mixer spur table.  When provided, spur levels are taken "
            "from this table (and reported as non-illustrative) instead of the "
            "built-in illustrative model.  Products not listed are omitted."
        ),
    )


LineCategory = Literal[
    "desired", "im3", "im2", "lo_harmonic", "mixer_spur", "noise_marker"
]


class SpectrumLine(BaseModel):
    frequency_hz: float
    power_dbm: float
    category: LineCategory
    label: str
    illustrative: bool = False
    in_trace_span: bool = Field(
        default=True,
        description="False when the line lies outside the plotted analyzer span.",
    )


class SpectrumTrace(BaseModel):
    frequencies_hz: list[float]
    powers_dbm: list[float]
    noise_floor_dbm: float = Field(
        description="Noise level shown by the simulated analyzer (kT*RBW + NF, referred to this side)."
    )
    rbw_hz: float


class SpectrumSide(BaseModel):
    lines: list[SpectrumLine]
    trace: SpectrumTrace
    noise_floor_dbm: float = Field(
        description="Receiver noise floor (kTB + NF) referred to this side."
    )


class SpectrumResponse(BaseModel):
    rf: SpectrumSide
    if_: SpectrumSide = Field(alias="if")
    noise_floor_dbm: float = Field(
        description="Input-referred receiver noise floor, kTB + NF (dBm)."
    )
    warnings: list[Warning]

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# IP3 curve (Phase 3)
# ---------------------------------------------------------------------------


class Ip3CurveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    iip3_dbm: float
    gain_db: float = 0.0
    nf_db: float = 0.0
    bandwidth_hz: float = Field(gt=0, default=1_000_000.0)
    temperature_k: float = Field(gt=0, default=290.0)
    ip1db_in_dbm: float | None = None
    pin_min_dbm: float = -140.0
    pin_max_dbm: float | None = None
    num_points: int = Field(default=201, ge=10, le=2001)


class Ip3CurvePoint(BaseModel):
    pin_dbm: float
    fundamental_out_dbm: float
    im3_out_dbm: float


class Ip3CurveResponse(BaseModel):
    points: list[Ip3CurvePoint]
    iip3_dbm: float
    oip3_dbm: float
    noise_floor_in_dbm: float
    noise_floor_out_dbm: float
    sfdr3_db: float
    pin_at_im3_eq_noise_dbm: float
    valid_region_max_dbm: float
    valid_region_source: Literal["ip1db", "iip3_minus_10"]
    gain_db: float


# ---------------------------------------------------------------------------
# Jammer (Phase 4)
# ---------------------------------------------------------------------------


class JammerNoiseSource(BaseModel):
    """Flat-top (rectangular) noise jammer at the antenna."""

    model_config = ConfigDict(extra="forbid")

    p_dbm: float = Field(description="Total jammer power at the antenna (dBm).")
    f_center_hz: float = Field(gt=0, description="Center frequency of the jammer band (Hz).")
    bandwidth_hz: float = Field(gt=0, description="Jammer bandwidth (Hz).")


class JammerCwTone(BaseModel):
    """One CW tone (jammer or desired-signal helper)."""

    model_config = ConfigDict(extra="forbid")

    f_hz: float = Field(gt=0)
    p_dbm: float


class JammerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Desired signal
    desired_f_hz: float = Field(gt=0, description="Desired-signal center frequency (Hz).")
    desired_p_dbm: float = Field(description="Desired-signal input power at the antenna (dBm).")
    required_snr_db: float = Field(
        default=10.0, description="Demodulator SNR requirement (dB)."
    )

    # Cascaded receiver quantities (mirror the IP3 tab: linked or edited).
    iip3_dbm: float = Field(description="Cascaded input-referred IIP3 (dBm).")
    nf_db: float = Field(default=0.0, description="Cascaded noise figure (dB).")
    bandwidth_hz: float = Field(gt=0, default=1_000_000.0, description="Receiver noise bandwidth (Hz).")
    temperature_k: float = Field(gt=0, default=290.0)
    input_p1db_dbm: float | None = Field(
        default=None,
        description=(
            "Cascaded input P1dB estimate (dBm).  When omitted compression "
            "and AGC are skipped."
        ),
    )
    agc_backoff_db: float = Field(
        default=3.0,
        ge=0.0,
        description="Target headroom between the front-end power and input P1dB.",
    )

    # Preselect (brick-wall; first filter in the chain).
    preselect_passband_min_hz: float | None = None
    preselect_passband_max_hz: float | None = None
    preselect_stopband_rejection_db: float | None = Field(default=None, ge=0.0)
    preselect_label: str = Field(
        default="RF preselect",
        description="Name of the preselect filter (for the readout only).",
    )

    # Jammers (one noise jammer, up to two CW tones).
    noise: JammerNoiseSource | None = None
    cw_tones: list[JammerCwTone] | None = Field(default=None, max_length=2)


class JammerIm3Product(BaseModel):
    frequency_hz: float
    power_dbm: float
    label: str
    valid: bool = Field(
        default=True,
        description=(
            "False when the small-signal cubic IM3 law is being extrapolated "
            "past input P1dB; the number is a sketch, not a prediction."
        ),
    )


class JammerScenario(BaseModel):
    """Numbers for one AGC column (either 'off' with pad=0 or 'on')."""

    label: str
    agc_on: bool
    pad_db: float
    nf_db: float
    iip3_dbm: float
    input_p1db_dbm: float | None
    thermal_floor_dbm: float
    jammer_in_channel_dbm: float = Field(
        description="Total jammer power inside the receiver bandwidth (dBm).  -inf if none."
    )
    effective_floor_dbm: float = Field(
        description="Thermal floor power-summed with the in-channel jammer power (dBm)."
    )
    desired_power_dbm: float
    snr_db: float
    snr_margin_db: float = Field(
        description="SNR minus required_snr_db (positive = link closes)."
    )
    front_end_power_dbm: float = Field(
        description=(
            "Total jammer power at the first compressing stage, after preselect "
            "and pad.  -inf when there is no jammer."
        )
    )
    p1db_headroom_db: float | None = Field(
        description="input_p1db_dbm - front_end_power_dbm; None if no P1dB."
    )
    compressing: bool
    gain_reduction_db: float = Field(
        description="Labelled compression sketch: 0 below P1dB, 1 at P1dB, dB-for-dB above."
    )
    cw_tones: list[JammerCwTone]
    im3_products: list[JammerIm3Product]
    im3_valid: bool


class JammerResponse(BaseModel):
    scenario_off: JammerScenario
    scenario_on: JammerScenario | None = Field(
        default=None,
        description="AGC-on column; None when no input P1dB is available.",
    )
    thermal_floor_dbm: float = Field(
        description="kTB + NF at the supplied bandwidth/NF, without any pad (dBm)."
    )
    preselect_attenuation_db_noise: float = Field(
        description="Rejection applied to the noise jammer, 0 when in passband or when no filter is set."
    )
    warnings: list[Warning]
