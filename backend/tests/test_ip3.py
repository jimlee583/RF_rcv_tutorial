"""IP3 / SFDR curve engine and /api/ip3-curve endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.rf.ip3curve import (
    SMALL_SIGNAL_MARGIN_DB,
    build_ip3_curve,
    default_pin_max_dbm,
    fundamental_out_dbm,
    im3_out_dbm,
    valid_region_max_dbm,
)
from app.rf.noise import KTB_DBM_PER_HZ_T0
from app.schemas import Ip3CurveRequest

client = TestClient(app)


def _req(**overrides) -> Ip3CurveRequest:
    base = dict(
        iip3_dbm=0.0,
        gain_db=0.0,
        nf_db=0.0,
        bandwidth_hz=1e6,
        temperature_k=290.0,
        num_points=21,
    )
    base.update(overrides)
    return Ip3CurveRequest(**base)


def test_fundamental_is_one_db_per_db() -> None:
    assert fundamental_out_dbm(-40.0, 20.0) == pytest.approx(-20.0)
    # Slope: +1 dB in => +1 dB out.
    assert fundamental_out_dbm(-39.0, 20.0) - fundamental_out_dbm(-40.0, 20.0) == pytest.approx(
        1.0
    )


def test_im3_is_three_db_per_db() -> None:
    # Equal-tone IM3: 3 Pin + G - 2 IIP3.  Slope vs Pin is 3 dB/dB.
    a = im3_out_dbm(-40.0, 0.0, 0.0)
    b = im3_out_dbm(-39.0, 0.0, 0.0)
    assert a == pytest.approx(-120.0)
    assert b - a == pytest.approx(3.0)


def test_intercept_is_at_iip3_oip3() -> None:
    iip3, gain = 7.0, 15.0
    fund = fundamental_out_dbm(iip3, gain)
    im3 = im3_out_dbm(iip3, iip3, gain)
    assert fund == pytest.approx(iip3 + gain)
    assert im3 == pytest.approx(fund)


def test_valid_region_uses_p1db_when_given() -> None:
    mx, src = valid_region_max_dbm(10.0, -2.0)
    assert mx == pytest.approx(-2.0)
    assert src == "ip1db"


def test_valid_region_falls_back_to_iip3_minus_10() -> None:
    mx, src = valid_region_max_dbm(10.0, None)
    assert mx == pytest.approx(10.0 - SMALL_SIGNAL_MARGIN_DB)
    assert src == "iip3_minus_10"


def test_spec_case_sfdr_80_and_im3_on_noise() -> None:
    """Spec: IIP3 = 0 dBm, N = −120 dBm => SFDR = 80 dB, Pin|IM3=N = −40 dBm."""
    # kTB + NF = −120 dBm at T = 290 K, NF = 0 => B from kT (dBm/Hz).
    bandwidth = 10.0 ** ((-120.0 - KTB_DBM_PER_HZ_T0) / 10.0)
    resp = build_ip3_curve(_req(iip3_dbm=0.0, gain_db=0.0, nf_db=0.0, bandwidth_hz=bandwidth))
    assert resp.noise_floor_in_dbm == pytest.approx(-120.0, abs=1e-9)
    assert resp.sfdr3_db == pytest.approx(80.0, abs=1e-9)
    assert resp.pin_at_im3_eq_noise_dbm == pytest.approx(-40.0, abs=1e-9)
    # Two −40 dBm tones: each IM3 product at −120 dBm (gain = 0).
    assert im3_out_dbm(-40.0, 0.0, 0.0) == pytest.approx(-120.0)
    assert resp.oip3_dbm == pytest.approx(0.0)


def test_gain_shifts_curves_and_oip3_not_sfdr() -> None:
    bandwidth = 10.0 ** ((-120.0 - KTB_DBM_PER_HZ_T0) / 10.0)
    a = build_ip3_curve(_req(gain_db=0.0, bandwidth_hz=bandwidth))
    b = build_ip3_curve(_req(gain_db=20.0, bandwidth_hz=bandwidth))
    assert b.oip3_dbm - a.oip3_dbm == pytest.approx(20.0)
    assert b.noise_floor_out_dbm - a.noise_floor_out_dbm == pytest.approx(20.0)
    assert b.sfdr3_db == pytest.approx(a.sfdr3_db)
    assert b.pin_at_im3_eq_noise_dbm == pytest.approx(a.pin_at_im3_eq_noise_dbm)
    # Every plotted point's outputs move by G; Pin axis is unchanged.
    assert b.points[0].pin_dbm == pytest.approx(a.points[0].pin_dbm)
    assert b.points[0].fundamental_out_dbm - a.points[0].fundamental_out_dbm == pytest.approx(
        20.0
    )
    assert b.points[0].im3_out_dbm - a.points[0].im3_out_dbm == pytest.approx(20.0)


def test_default_pin_max_shows_the_intercept() -> None:
    assert default_pin_max_dbm(-5.0) == pytest.approx(5.0)
    resp = build_ip3_curve(_req(iip3_dbm=-5.0, pin_max_dbm=None, pin_min_dbm=-20.0))
    assert resp.points[-1].pin_dbm == pytest.approx(5.0)
    # Sweep includes the intercept Pin = IIP3 = −5 dBm.
    assert resp.points[0].pin_dbm <= -5.0 <= resp.points[-1].pin_dbm
    # At that Pin the two extrapolated curves meet at OIP3.
    assert im3_out_dbm(-5.0, -5.0, 0.0) == pytest.approx(
        fundamental_out_dbm(-5.0, 0.0)
    )


def test_swaps_inverted_pin_range() -> None:
    resp = build_ip3_curve(_req(pin_min_dbm=10.0, pin_max_dbm=0.0, num_points=11))
    assert resp.points[0].pin_dbm < resp.points[-1].pin_dbm
    assert len(resp.points) == 11


def test_num_points_respected() -> None:
    resp = build_ip3_curve(_req(num_points=51))
    assert len(resp.points) == 51


def test_api_endpoint_spec_case() -> None:
    bandwidth = 10.0 ** ((-120.0 - KTB_DBM_PER_HZ_T0) / 10.0)
    r = client.post(
        "/api/ip3-curve",
        json={
            "iip3_dbm": 0.0,
            "gain_db": 0.0,
            "nf_db": 0.0,
            "bandwidth_hz": bandwidth,
            "temperature_k": 290.0,
            "num_points": 21,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["sfdr3_db"] == pytest.approx(80.0)
    assert body["pin_at_im3_eq_noise_dbm"] == pytest.approx(-40.0)
    assert body["oip3_dbm"] == pytest.approx(0.0)
    assert body["valid_region_source"] == "iip3_minus_10"
    assert body["valid_region_max_dbm"] == pytest.approx(-10.0)
    assert len(body["points"]) == 21


def test_api_uses_supplied_p1db_as_valid_edge() -> None:
    r = client.post(
        "/api/ip3-curve",
        json={"iip3_dbm": 5.0, "ip1db_in_dbm": -4.0, "num_points": 11},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["valid_region_source"] == "ip1db"
    assert body["valid_region_max_dbm"] == pytest.approx(-4.0)
    assert body["oip3_dbm"] == pytest.approx(5.0)  # default gain 0
