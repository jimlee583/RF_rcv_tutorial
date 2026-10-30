"""Two-tone spectrum engine and /api/spectrum endpoint."""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.rf.spectrum import (
    analyzer_trace,
    build_spectrum,
    im2_product_power_dbm,
    im3_product_powers_dbm,
)
from app.schemas import MixerSpurEntry, SpectrumLine, SpectrumRequest


def _spec_default(**overrides) -> SpectrumRequest:
    base = dict(
        f1_hz=2.09e9,
        f2_hz=2.11e9,
        p1_dbm=-40.0,
        p2_dbm=-40.0,
        lo_hz=2.00e9,
        sideband="lower",
        iip3_dbm=0.0,
        gain_db=0.0,
        nf_db=0.0,
        bandwidth_hz=1e6,
    )
    base.update(overrides)
    return SpectrumRequest(**base)


def _line(resp_side, label: str) -> SpectrumLine:
    return next(ln for ln in resp_side.lines if ln.label == label)


# ---------------------------------------------------------------------------
# Product power formulas
# ---------------------------------------------------------------------------


def test_spec_case_equal_tones_minus_40_iip3_zero() -> None:
    """Spec: IIP3 = 0 dBm, two -40 dBm tones => each IM3 product at -120 dBm."""
    lo, hi = im3_product_powers_dbm(-40.0, -40.0, 0.0)
    assert lo == pytest.approx(-120.0)
    assert hi == pytest.approx(-120.0)


def test_im3_slope_is_3_db_per_db() -> None:
    a = im3_product_powers_dbm(-40.0, -40.0, 10.0)[0]
    b = im3_product_powers_dbm(-39.0, -39.0, 10.0)[0]
    assert b - a == pytest.approx(3.0)


def test_im3_unequal_tones() -> None:
    # P1 = -40, P2 = -50, IIP3 = 0:
    #   2f1 - f2 : 2*(-40) + (-50) = -130 dBm
    #   2f2 - f1 : 2*(-50) + (-40) = -140 dBm
    lo, hi = im3_product_powers_dbm(-40.0, -50.0, 0.0)
    assert lo == pytest.approx(-130.0)
    assert hi == pytest.approx(-140.0)


def test_im2_power() -> None:
    assert im2_product_power_dbm(-40.0, -40.0, 40.0) == pytest.approx(-120.0)


# ---------------------------------------------------------------------------
# Analyzer trace
# ---------------------------------------------------------------------------


def test_trace_peak_matches_line_power_and_floor() -> None:
    lines = [SpectrumLine(frequency_hz=100e6, power_dbm=-30.0, category="desired", label="t")]
    tr = analyzer_trace(lines, 90e6, 110e6, noise_floor_dbm=-110.0, rbw_hz=1e6)
    freqs = np.asarray(tr.frequencies_hz)
    pows = np.asarray(tr.powers_dbm)
    assert pows.max() == pytest.approx(-30.0, abs=0.01)
    assert freqs[pows.argmax()] == pytest.approx(100e6)
    # Far from the tone the trace sits on the noise floor.
    assert pows[0] == pytest.approx(-110.0, abs=0.01)
    # 3 dB bandwidth equals RBW: at +/- RBW/2 the response is 3 dB down.
    idx = np.abs(freqs - (100e6 + 0.5e6)).argmin()
    assert pows[idx] == pytest.approx(-33.0, abs=0.1)
    assert tr.rbw_hz == 1e6


def test_trace_is_monotone_sorted() -> None:
    lines = [SpectrumLine(frequency_hz=1e6, power_dbm=-30.0, category="desired", label="t")]
    tr = analyzer_trace(lines, 0.0, 2e6, -100.0, 10e3)
    assert np.all(np.diff(tr.frequencies_hz) > 0)
    assert len(tr.frequencies_hz) == len(tr.powers_dbm)


# ---------------------------------------------------------------------------
# build_spectrum: spec default case end-to-end
# ---------------------------------------------------------------------------


def test_build_spectrum_spec_default_frequencies_and_powers() -> None:
    resp = build_spectrum(_spec_default())

    # RF side, input-referred.
    assert _line(resp.rf, "Tone 1 (f1)").frequency_hz == pytest.approx(2.09e9)
    assert _line(resp.rf, "Tone 2 (f2)").frequency_hz == pytest.approx(2.11e9)
    im3_lo = _line(resp.rf, "IM3: 2f1 - f2")
    im3_hi = _line(resp.rf, "IM3: 2f2 - f1")
    assert im3_lo.frequency_hz == pytest.approx(2.07e9)
    assert im3_hi.frequency_hz == pytest.approx(2.13e9)
    assert im3_lo.power_dbm == pytest.approx(-120.0)
    assert im3_hi.power_dbm == pytest.approx(-120.0)

    # IF side.
    assert _line(resp.if_, "Tone 1 at IF").frequency_hz == pytest.approx(90e6)
    assert _line(resp.if_, "Tone 2 at IF").frequency_hz == pytest.approx(110e6)
    assert _line(resp.if_, "IM3 (2f1 - f2) at IF").frequency_hz == pytest.approx(70e6)
    assert _line(resp.if_, "IM3 (2f2 - f1) at IF").frequency_hz == pytest.approx(130e6)

    # Noise floor: -174 + 60 + 0 = -114 dBm.
    assert resp.noise_floor_dbm == pytest.approx(-114.0, abs=0.05)
    assert resp.rf.noise_floor_dbm == pytest.approx(resp.noise_floor_dbm)
    # Lines are sorted by frequency on each side.
    for side in (resp.rf, resp.if_):
        f = [ln.frequency_hz for ln in side.lines]
        assert f == sorted(f)


def test_gain_refers_if_side_to_output() -> None:
    resp = build_spectrum(_spec_default(gain_db=40.0, nf_db=3.0))
    assert _line(resp.if_, "Tone 1 at IF").power_dbm == pytest.approx(0.0)
    assert _line(resp.if_, "IM3 (2f1 - f2) at IF").power_dbm == pytest.approx(-80.0)
    assert resp.if_.noise_floor_dbm == pytest.approx(resp.rf.noise_floor_dbm + 40.0)
    assert resp.if_.trace.noise_floor_dbm == pytest.approx(resp.rf.trace.noise_floor_dbm + 40.0)


def test_unequal_tone_powers_propagate() -> None:
    resp = build_spectrum(_spec_default(p1_dbm=-40.0, p2_dbm=-50.0))
    assert _line(resp.rf, "IM3: 2f1 - f2").power_dbm == pytest.approx(-130.0)
    assert _line(resp.rf, "IM3: 2f2 - f1").power_dbm == pytest.approx(-140.0)


def test_rbw_defaults_to_bandwidth_and_sets_trace_floor() -> None:
    resp = build_spectrum(_spec_default())
    assert resp.rf.trace.rbw_hz == 1e6
    assert resp.rf.trace.noise_floor_dbm == pytest.approx(resp.noise_floor_dbm)
    narrow = build_spectrum(_spec_default(rbw_hz=10e3))
    # 100x narrower RBW => trace floor 20 dB lower; receiver floor unchanged.
    assert narrow.rf.trace.noise_floor_dbm == pytest.approx(resp.noise_floor_dbm - 20.0, abs=0.01)
    assert narrow.noise_floor_dbm == pytest.approx(resp.noise_floor_dbm)


def test_trace_peaks_land_on_tones() -> None:
    resp = build_spectrum(_spec_default(p1_dbm=-20.0, p2_dbm=-20.0, iip3_dbm=10.0))
    f = np.asarray(resp.rf.trace.frequencies_hz)
    p = np.asarray(resp.rf.trace.powers_dbm)
    i1 = np.abs(f - 2.09e9).argmin()
    assert p[i1] == pytest.approx(-20.0, abs=0.05)
    i3 = np.abs(f - 2.07e9).argmin()
    # IM3 = 3*(-20) - 2*10 = -80 dBm; well above the -114 floor so visible.
    assert p[i3] == pytest.approx(-80.0, abs=0.05)


def test_categories_present_and_spurs_illustrative_by_default() -> None:
    resp = build_spectrum(_spec_default())
    cats_if = {ln.category for ln in resp.if_.lines}
    assert {"desired", "im3", "lo_harmonic", "mixer_spur"} <= cats_if
    spurs = [ln for ln in resp.if_.lines if ln.category == "mixer_spur"]
    # The other-sideband (1,1) product is real; every other spur is illustrative.
    for ln in spurs:
        if "other sideband" in ln.label:
            assert ln.illustrative is False
        else:
            assert ln.illustrative is True
    assert any("illustrative" in w.message.lower() for w in resp.warnings)
    # IM2 absent when IIP2 not supplied.
    assert "im2" not in cats_if
    resp2 = build_spectrum(_spec_default(iip2_dbm=40.0))
    assert "im2" in {ln.category for ln in resp2.rf.lines}


def test_spur_toggle_and_measured_table() -> None:
    off = build_spectrum(_spec_default(include_mixer_spurs=False))
    assert not any(ln.category == "mixer_spur" for ln in off.if_.lines)

    measured = build_spectrum(
        _spec_default(spur_table=[MixerSpurEntry(m=2, n=1, suppression_dbc=60.0)])
    )
    spurs = [
        ln for ln in measured.if_.lines
        if ln.category == "mixer_spur" and "other sideband" not in ln.label
    ]
    assert spurs
    assert all(ln.illustrative is False for ln in spurs)
    # 2RF - 1LO for tone 1: |2*2.09 - 2.0| GHz = 2.18 GHz at -40 - 60 = -100 dBm.
    t1 = next(ln for ln in spurs if ln.label == "Tone 1: 2RF - 1LO")
    assert t1.frequency_hz == pytest.approx(2.18e9)
    assert t1.power_dbm == pytest.approx(-100.0)
    assert not any("illustrative" in w.message.lower() for w in measured.warnings)


def test_warnings_for_large_signal_and_coincident_tones() -> None:
    hot = build_spectrum(_spec_default(p1_dbm=-5.0))
    assert any(w.severity == "warning" and "IIP3" in w.message for w in hot.warnings)
    same = build_spectrum(_spec_default(f2_hz=2.09e9))
    assert any(w.severity == "error" for w in same.warnings)


def test_in_trace_span_flag() -> None:
    resp = build_spectrum(_spec_default())
    # The LO feedthrough at 2 GHz is far outside the ~100 MHz IF span.
    lo_if = _line(resp.if_, "LO feedthrough at IF")
    assert lo_if.in_trace_span is False
    assert _line(resp.if_, "Tone 1 at IF").in_trace_span is True


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


def test_api_spectrum_endpoint() -> None:
    client = TestClient(app)
    payload = {
        "f1_hz": 2.09e9,
        "f2_hz": 2.11e9,
        "p1_dbm": -40.0,
        "p2_dbm": -40.0,
        "lo_hz": 2.0e9,
        "iip3_dbm": 0.0,
        "bandwidth_hz": 1e6,
    }
    r = client.post("/api/spectrum", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    # Response uses the 'if' alias, not 'if_'.
    assert "if" in body and "if_" not in body
    assert "rf" in body
    assert len(body["rf"]["trace"]["frequencies_hz"]) >= 1601
    im3 = [ln for ln in body["rf"]["lines"] if ln["category"] == "im3"]
    assert {round(ln["power_dbm"], 6) for ln in im3} == {-120.0}


def test_api_spectrum_rejects_bad_input() -> None:
    client = TestClient(app)
    r = client.post("/api/spectrum", json={"f1_hz": -1, "f2_hz": 1, "p1_dbm": 0, "p2_dbm": 0, "lo_hz": 1, "iip3_dbm": 0})
    assert r.status_code == 422
