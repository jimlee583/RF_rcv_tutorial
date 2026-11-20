"""Jammer impact engine and /api/jammer endpoint."""

from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.rf.jammer import (
    agc_pad_db,
    build_jammer,
    noise_jammer_in_channel_dbm,
    power_sum_dbm,
    preselect_attenuation_db,
)
from app.rf.spectrum import im3_product_powers_dbm
from app.schemas import (
    JammerCwTone,
    JammerNoiseSource,
    JammerRequest,
)

client = TestClient(app)


def _req(**overrides) -> JammerRequest:
    """Default: 2.10 GHz desired signal, 1 MHz B, NF=5, IIP3=0 dBm, P1dB=-10 dBm,
    preselect 2.0-2.2 GHz with 50 dB rejection."""
    base = dict(
        desired_f_hz=2.10e9,
        desired_p_dbm=-80.0,
        required_snr_db=10.0,
        iip3_dbm=0.0,
        nf_db=5.0,
        bandwidth_hz=1.0e6,
        temperature_k=290.0,
        input_p1db_dbm=-10.0,
        agc_backoff_db=3.0,
        preselect_passband_min_hz=2.0e9,
        preselect_passband_max_hz=2.2e9,
        preselect_stopband_rejection_db=50.0,
    )
    base.update(overrides)
    return JammerRequest(**base)


# ---------------------------------------------------------------------------
# Preselect
# ---------------------------------------------------------------------------


def test_preselect_in_passband_adds_no_extra_attenuation() -> None:
    assert preselect_attenuation_db(2.1e9, 2.0e9, 2.2e9, 50.0) == pytest.approx(0.0)


def test_preselect_out_of_band_applies_stopband_rejection() -> None:
    assert preselect_attenuation_db(2.5e9, 2.0e9, 2.2e9, 50.0) == pytest.approx(50.0)
    assert preselect_attenuation_db(1.5e9, 2.0e9, 2.2e9, 50.0) == pytest.approx(50.0)


def test_preselect_missing_values_are_zero_rejection() -> None:
    assert preselect_attenuation_db(2.5e9, None, 2.2e9, 50.0) == pytest.approx(0.0)
    assert preselect_attenuation_db(2.5e9, 2.0e9, 2.2e9, None) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Noise-jammer slice
# ---------------------------------------------------------------------------


def test_noise_jammer_fully_inside_channel_equals_total_power() -> None:
    # Jammer 100 kHz wide, inside a 1 MHz channel => all of it is in-band.
    p = noise_jammer_in_channel_dbm(
        p_dbm=-50.0,
        jammer_bw_hz=0.1e6,
        jammer_center_hz=2.1e9,
        desired_hz=2.1e9,
        receiver_bw_hz=1.0e6,
    )
    assert p == pytest.approx(-50.0)


def test_noise_jammer_wider_than_channel_scales_by_fraction() -> None:
    # 10 MHz jammer vs 1 MHz channel centered on it => fraction = 0.1 (-10 dB).
    p = noise_jammer_in_channel_dbm(
        p_dbm=-30.0,
        jammer_bw_hz=10.0e6,
        jammer_center_hz=2.1e9,
        desired_hz=2.1e9,
        receiver_bw_hz=1.0e6,
    )
    assert p == pytest.approx(-40.0)


def test_noise_jammer_no_overlap_returns_minus_inf() -> None:
    p = noise_jammer_in_channel_dbm(
        p_dbm=-30.0,
        jammer_bw_hz=1.0e6,
        jammer_center_hz=2.5e9,
        desired_hz=2.1e9,
        receiver_bw_hz=1.0e6,
    )
    assert p == float("-inf")


# ---------------------------------------------------------------------------
# AGC pad sizing
# ---------------------------------------------------------------------------


def test_agc_pad_zero_when_below_backoff_target() -> None:
    assert agc_pad_db(-20.0, -10.0, 3.0) == pytest.approx(0.0)


def test_agc_pad_sizes_to_restore_backoff() -> None:
    # Front end at 0 dBm, P1dB=-10, backoff=3 => target=-13, pad = 13 dB.
    assert agc_pad_db(0.0, -10.0, 3.0) == pytest.approx(13.0)


def test_agc_pad_zero_when_no_p1db() -> None:
    assert agc_pad_db(20.0, None, 3.0) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Power sum
# ---------------------------------------------------------------------------


def test_power_sum_two_equal_powers_is_three_db_up() -> None:
    assert power_sum_dbm([-30.0, -30.0]) == pytest.approx(-30.0 + 3.0103, abs=1e-3)


def test_power_sum_empty_and_minus_inf() -> None:
    assert power_sum_dbm([]) == float("-inf")
    assert power_sum_dbm([float("-inf"), float("-inf")]) == float("-inf")


# ---------------------------------------------------------------------------
# build_jammer: in-channel noise raises the effective floor
# ---------------------------------------------------------------------------


def test_in_channel_noise_power_sums_with_thermal_floor() -> None:
    # Thermal: -174 + 60 + 5 = -109 dBm.
    # Jammer: -80 dBm fully in-channel.  Effective floor = -80 + a hair.
    resp = build_jammer(
        _req(
            noise=JammerNoiseSource(p_dbm=-80.0, f_center_hz=2.1e9, bandwidth_hz=1.0e6),
        )
    )
    assert resp.thermal_floor_dbm == pytest.approx(-109.0, abs=0.05)
    off = resp.scenario_off
    # Jammer power inside the channel is the entire -80 dBm.
    assert off.jammer_in_channel_dbm == pytest.approx(-80.0, abs=1e-6)
    # Effective floor is the power sum of -109 dBm and -80 dBm, basically -80.
    # 10 log10(10^-11 + 10^-8) mW = 10 log10(1e-8 + 1e-11) ~= -80.004 dBm.
    expected = 10 * math.log10(10 ** -8 + 10 ** -10.9)
    assert off.effective_floor_dbm == pytest.approx(expected, abs=0.05)


def test_out_of_band_noise_rejected_before_entering_channel() -> None:
    # Same jammer centered at 2.5 GHz (outside preselect) => 50 dB down.
    resp = build_jammer(
        _req(
            noise=JammerNoiseSource(p_dbm=-30.0, f_center_hz=2.5e9, bandwidth_hz=1.0e6),
        )
    )
    off = resp.scenario_off
    assert off.jammer_in_channel_dbm == float("-inf")
    # Effective floor equals the thermal floor; no in-band contribution.
    assert off.effective_floor_dbm == pytest.approx(resp.thermal_floor_dbm)
    assert resp.preselect_attenuation_db_noise == pytest.approx(50.0)
    # Front-end power is the jammer power attenuated by 50 dB.
    assert off.front_end_power_dbm == pytest.approx(-80.0)


def test_wide_noise_compresses_on_total_while_channel_rises_by_slice() -> None:
    # 100 MHz-wide noise jammer at 2.1 GHz, total -5 dBm.  Inside a 1 MHz
    # channel: fraction 1/100 => -5 - 20 = -25 dBm in-band.  Front-end power
    # is the full -5 dBm, which blows past P1dB=-10 => AGC pad engages.
    resp = build_jammer(
        _req(
            noise=JammerNoiseSource(p_dbm=-5.0, f_center_hz=2.1e9, bandwidth_hz=100.0e6),
        )
    )
    off = resp.scenario_off
    assert off.front_end_power_dbm == pytest.approx(-5.0, abs=1e-6)
    assert off.jammer_in_channel_dbm == pytest.approx(-25.0, abs=1e-6)
    assert off.compressing is True
    on = resp.scenario_on
    assert on is not None
    # Target backoff: P1dB - 3 = -13 dBm.  Pad = -5 - (-13) = 8 dB.
    assert on.pad_db == pytest.approx(8.0, abs=1e-6)
    # NF rises by the pad.
    assert on.nf_db == pytest.approx(resp.scenario_off.nf_db + 8.0)
    # Front-end power now sits at the backoff target.
    assert on.front_end_power_dbm == pytest.approx(-13.0, abs=1e-6)
    assert on.compressing is False


# ---------------------------------------------------------------------------
# CW jammer: IM3 + landing in-channel
# ---------------------------------------------------------------------------


def test_cw_im3_products_match_spectrum_formula() -> None:
    # Two CW tones at -30 dBm inside the preselect; IIP3=0.
    resp = build_jammer(
        _req(
            cw_tones=[
                JammerCwTone(f_hz=2.095e9, p_dbm=-30.0),
                JammerCwTone(f_hz=2.105e9, p_dbm=-30.0),
            ]
        )
    )
    off = resp.scenario_off
    labels = {p.label: p for p in off.im3_products}
    # Equal tones: both products at 3*(-30) - 2*0 = -90 dBm.
    assert labels["2 f1 - f2"].power_dbm == pytest.approx(-90.0)
    assert labels["2 f2 - f1"].power_dbm == pytest.approx(-90.0)
    # Cross-check against the shared formula.
    p_lo, p_hi = im3_product_powers_dbm(-30.0, -30.0, 0.0)
    assert labels["2 f1 - f2"].power_dbm == pytest.approx(p_lo)
    assert labels["2 f2 - f1"].power_dbm == pytest.approx(p_hi)


def test_two_cw_tones_with_im3_landing_on_desired() -> None:
    # Desired at 2.10 GHz, B = 1 MHz.  Tones outside B but still in preselect
    # so that 2 f1 - f2 = 2.10 GHz exactly.
    f1 = 2.095e9
    f2 = 2 * f1 - 2.10e9  # 2.090 GHz, both outside the 1 MHz desired bin.
    resp = build_jammer(
        _req(
            cw_tones=[
                JammerCwTone(f_hz=f1, p_dbm=-30.0),
                JammerCwTone(f_hz=f2, p_dbm=-30.0),
            ]
        )
    )
    off = resp.scenario_off
    on_bin = [p for p in off.im3_products if abs(p.frequency_hz - 2.10e9) < 1e3]
    assert on_bin, "An IM3 product should land exactly on the desired frequency"
    # In-channel jammer power = that one IM3 product (-90 dBm); tones are
    # outside the 1 MHz channel.
    assert off.jammer_in_channel_dbm == pytest.approx(on_bin[0].power_dbm, abs=0.05)


# ---------------------------------------------------------------------------
# AGC trade: NF up, antenna-referred IM3 down, in-channel C/I unchanged
# ---------------------------------------------------------------------------


def test_pad_raises_nf_drops_antenna_referred_im3_leaves_c_over_i() -> None:
    # One CW jammer in-channel that forces compression.  Desired signal also
    # in-channel so we can read C/I.
    resp = build_jammer(
        _req(
            desired_p_dbm=-50.0,
            cw_tones=[JammerCwTone(f_hz=2.1e9, p_dbm=-5.0)],
        )
    )
    off = resp.scenario_off
    on = resp.scenario_on
    assert on is not None
    assert on.pad_db > 0
    # NF rises by the pad.
    assert on.nf_db == pytest.approx(off.nf_db + on.pad_db, abs=1e-6)
    # Antenna-referred IIP3 rises by A (output IM3 would fall by 3A; the
    # antenna-referred product falls by 2A).
    assert on.iip3_dbm == pytest.approx(off.iip3_dbm + on.pad_db, abs=1e-6)
    # In-channel C/I is unchanged: pad attenuates desired and jammer equally.
    ci_off = off.desired_power_dbm - off.jammer_in_channel_dbm
    ci_on = on.desired_power_dbm - on.jammer_in_channel_dbm
    assert ci_on == pytest.approx(ci_off, abs=1e-6)


def test_no_p1db_skips_agc_and_emits_warning() -> None:
    resp = build_jammer(
        _req(
            input_p1db_dbm=None,
            cw_tones=[JammerCwTone(f_hz=2.1e9, p_dbm=-20.0)],
        )
    )
    assert resp.scenario_on is None
    assert resp.scenario_off.compressing is False
    assert resp.scenario_off.pad_db == 0.0
    assert any("P1dB" in w.message for w in resp.warnings)


def test_compressing_front_end_emits_warning_and_invalidates_im3() -> None:
    resp = build_jammer(
        _req(
            cw_tones=[
                JammerCwTone(f_hz=2.1e9, p_dbm=0.0),
                JammerCwTone(f_hz=2.11e9, p_dbm=0.0),
            ]
        )
    )
    off = resp.scenario_off
    assert off.compressing is True
    assert off.gain_reduction_db > 0.0
    assert off.im3_valid is False
    assert all(p.valid is False for p in off.im3_products)
    assert any(w.severity == "warning" for w in resp.warnings)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


def test_api_jammer_endpoint() -> None:
    payload = {
        "desired_f_hz": 2.10e9,
        "desired_p_dbm": -80.0,
        "iip3_dbm": 0.0,
        "nf_db": 5.0,
        "bandwidth_hz": 1.0e6,
        "temperature_k": 290.0,
        "input_p1db_dbm": -10.0,
        "preselect_passband_min_hz": 2.0e9,
        "preselect_passband_max_hz": 2.2e9,
        "preselect_stopband_rejection_db": 50.0,
        "noise": {"p_dbm": -80.0, "f_center_hz": 2.1e9, "bandwidth_hz": 1.0e6},
    }
    r = client.post("/api/jammer", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "scenario_off" in body and "scenario_on" in body
    assert body["scenario_off"]["jammer_in_channel_dbm"] == pytest.approx(-80.0, abs=1e-6)
    assert body["thermal_floor_dbm"] == pytest.approx(-109.0, abs=0.05)


def test_api_rejects_bad_input() -> None:
    r = client.post("/api/jammer", json={"desired_f_hz": -1, "desired_p_dbm": 0, "iip3_dbm": 0})
    assert r.status_code == 422
