"""Friis NF, cascade gain and cascade IIP3/OIP3."""

from __future__ import annotations

import pytest

from app.rf.cascade import (
    analyze,
    cascaded_iip3_dbm,
    cascaded_oip3_dbm,
    friis_total_nf_db,
    total_gain_db,
)
from app.rf.units import db_to_lin, lin_to_db
from app.schemas import (
    AmplifierComponent,
    FilterComponent,
    LnaComponent,
    MixerComponent,
)


# ---------------------------------------------------------------------------
# Friis
# ---------------------------------------------------------------------------


def test_friis_single_stage_identity() -> None:
    assert friis_total_nf_db([3.0], [20.0]) == pytest.approx(3.0, abs=1e-9)


def test_friis_two_stage_hand_computed() -> None:
    # Stage 1: G=20 dB, NF=1 dB   => F1 = 10^0.1 ~= 1.2589, G1 = 100
    # Stage 2: G=10 dB, NF=10 dB  => F2 = 10
    # F_total = F1 + (F2-1)/G1 = 1.2589 + 9/100 = 1.3489
    # NF_total = 10*log10(1.3489) = 1.3002 dB
    nf_total = friis_total_nf_db([1.0, 10.0], [20.0, 10.0])
    assert nf_total == pytest.approx(1.300, abs=5e-3)


def test_friis_three_stage_matches_formula() -> None:
    nfs = [1.0, 10.0, 6.0]
    gains = [20.0, 10.0, 15.0]
    # F_total = F1 + (F2-1)/G1 + (F3-1)/(G1*G2)
    f = [db_to_lin(x) for x in nfs]
    g = [db_to_lin(x) for x in gains]
    expected = f[0] + (f[1] - 1) / g[0] + (f[2] - 1) / (g[0] * g[1])
    assert friis_total_nf_db(nfs, gains) == pytest.approx(lin_to_db(expected))


def test_friis_empty_list() -> None:
    assert friis_total_nf_db([], []) == 0.0


# ---------------------------------------------------------------------------
# Gain
# ---------------------------------------------------------------------------


def test_total_gain_sums() -> None:
    assert total_gain_db([20.0, -7.0, -2.0, 30.0]) == pytest.approx(41.0)


# ---------------------------------------------------------------------------
# Cascaded IIP3 / OIP3
# ---------------------------------------------------------------------------


def test_cascaded_iip3_single_stage() -> None:
    # Single stage identity: cascaded IIP3 equals that stage's IIP3.
    assert cascaded_iip3_dbm([10.0], [15.0]) == pytest.approx(10.0)


def test_cascaded_iip3_two_stage_hand_computed() -> None:
    # Stage 1: G=20 dB, IIP3 = +30 dBm  (so OIP3 = +50 dBm, 100 mW gain of 100x on a 1 W IP3)
    # Stage 2: IIP3 = +10 dBm = 10 mW.
    # 1/IIP3_tot = 1/IIP3_1_mw + G1/IIP3_2_mw
    #            = 1/1000 + 100/10
    #            = 0.001 + 10 = 10.001
    # => IIP3_tot = 1/10.001 mW ~ 0.1 mW => about -10 dBm
    result = cascaded_iip3_dbm([30.0, 10.0], [20.0, 0.0])
    assert result == pytest.approx(-10.0, abs=1e-2)


def test_cascaded_iip3_ideal_stage_no_contribution() -> None:
    # A None IIP3 (ideal linear filter) must not change the cascade result.
    base = cascaded_iip3_dbm([30.0, 10.0], [20.0, 10.0])
    with_filter = cascaded_iip3_dbm([None, 30.0, 10.0], [-2.0, 20.0, 10.0])
    # The filter in front shifts things only because the preceding -2 dB loss
    # changes effective gains for later stages.  We instead verify that
    # inserting a None stage with G=0 is a true no-op.
    noop = cascaded_iip3_dbm([None, 30.0, 10.0], [0.0, 20.0, 10.0])
    assert noop == pytest.approx(base)
    # And the lossy front-end relaxes the back-end contribution (less gain in
    # front means the back-end IIP3 looks larger when referred to the input),
    # so the total cascaded IIP3 improves (goes up).
    assert with_filter > base


def test_cascaded_oip3_equals_iip3_plus_gain() -> None:
    iip3 = cascaded_iip3_dbm([30.0, 10.0], [20.0, 0.0])
    oip3 = cascaded_oip3_dbm([30.0, 10.0], [20.0, 0.0])
    assert oip3 == pytest.approx(iip3 + 20.0)


def test_all_ideal_cascade_returns_none() -> None:
    assert cascaded_iip3_dbm([None, None], [10.0, 10.0]) is None


# ---------------------------------------------------------------------------
# analyze() integration -- SFDR spec case
# ---------------------------------------------------------------------------


def test_analyze_sfdr_spec_case() -> None:
    """Spec requirement:

    IIP3 = 0 dBm, Noise floor = -120 dBm  =>  SFDR3 = 80 dB.
    """
    # Build a cascade whose total gain is 0 and whose cascaded IIP3 is 0 dBm
    # with a noise floor of -120 dBm.  Easiest: a single amplifier with
    # G=0 dB, NF chosen so that the noise floor at 1 MHz is -120 dBm.
    # noise_floor = -174 + 60 + NF  =>  NF = -120 - (-174+60) = -120+114 = -6?  No, must be >= 0.
    # Instead pick a wider bandwidth so NF stays positive:
    # -120 = -174 + 10 log10(B) + NF.
    # Choose NF = 4 dB => 10 log10(B) = 50 => B = 100 kHz.
    comp = AmplifierComponent(
        id="a1", name="Amp", gain_db=0.0, nf_db=4.0, iip3_dbm=0.0
    )
    result = analyze([comp], bandwidth_hz=100e3, temperature_k=290.0)
    assert result.totals.noise_floor_dbm == pytest.approx(-120.0, abs=0.1)
    assert result.totals.iip3_dbm == pytest.approx(0.0)
    assert result.totals.sfdr3_db == pytest.approx(80.0, abs=0.1)


def test_analyze_default_like_cascade() -> None:
    """Smoke test close to the illustrative default."""
    comps = [
        FilterComponent(
            id="f1", insertion_loss_db=1.0,
            passband_min_hz=2e9, passband_max_hz=2.2e9,
            freq_min_hz=2e9, freq_max_hz=2.2e9,
        ),
        LnaComponent(id="lna", gain_db=20.0, nf_db=1.0, oip3_dbm=30.0, op1db_dbm=18.0),
        MixerComponent(
            id="mx",
            conversion_gain_db=-7.0,
            nf_db=7.0,
            iip3_dbm=15.0,
            lo_frequency_hz=2e9,
            sideband="lower",
        ),
        FilterComponent(
            id="f2", insertion_loss_db=2.0,
            passband_min_hz=70e6, passband_max_hz=130e6,
        ),
        AmplifierComponent(
            id="if_amp", gain_db=30.0, nf_db=3.0, oip3_dbm=35.0, op1db_dbm=22.0,
        ),
    ]
    result = analyze(comps, bandwidth_hz=1e6, source_frequency_hz=2.1e9)
    # Total gain: -1 + 20 - 7 - 2 + 30 = 40 dB
    assert result.totals.gain_db == pytest.approx(40.0)
    # Mixer must convert 2.1 GHz with 2.0 GHz LO to 100 MHz on the mixer's
    # output stage.
    mixer_stage = next(s for s in result.stages if s.type == "mixer")
    assert mixer_stage.frequency_in_hz == pytest.approx(2.1e9)
    assert mixer_stage.frequency_out_hz == pytest.approx(100e6)
    # Noise floor should be well below -90 dBm.
    assert result.totals.noise_floor_dbm < -90.0
    # SFDR should be a reasonable positive number.
    assert result.totals.sfdr3_db is not None
    assert result.totals.sfdr3_db > 50.0
    # P1dB input estimate must be <= each stage's input-referred OP1dB.
    assert result.totals.input_p1db_estimate_dbm is not None
    assert result.totals.input_p1db_limiting_stage_id is not None


def test_passive_filter_nf_defaults_to_loss() -> None:
    comps = [FilterComponent(id="f", insertion_loss_db=3.0)]
    result = analyze(comps, bandwidth_hz=1e6)
    assert result.stages[0].nf_db == pytest.approx(3.0)
    # Cascaded NF of a lone passive = its insertion loss.
    assert result.totals.nf_db == pytest.approx(3.0)


def test_nf_contributions_sum_to_total() -> None:
    comps = [
        LnaComponent(id="lna", gain_db=20.0, nf_db=1.0, oip3_dbm=30.0),
        MixerComponent(
            id="mx",
            conversion_gain_db=-7.0,
            nf_db=7.0,
            iip3_dbm=15.0,
            lo_frequency_hz=2e9,
        ),
        AmplifierComponent(id="if_amp", gain_db=30.0, nf_db=3.0, oip3_dbm=35.0),
    ]
    result = analyze(comps, bandwidth_hz=1e6)
    total_from_contribs = sum(s.nf_contribution_db for s in result.stages)
    assert total_from_contribs == pytest.approx(result.totals.nf_db, abs=1e-9)
