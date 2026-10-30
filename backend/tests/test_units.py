"""Unit conversion round-trips and sanity checks."""

from __future__ import annotations

import math

import pytest

from app.rf.units import (
    db_to_lin,
    dbm_to_mw,
    dbm_to_w,
    lin_to_db,
    mw_to_dbm,
    nf_db_from_noise_factor,
    noise_factor_from_nf_db,
    w_to_dbm,
)


@pytest.mark.parametrize(
    "db,expected",
    [
        (0.0, 1.0),
        (3.0103, 2.0),
        (10.0, 10.0),
        (20.0, 100.0),
        (-10.0, 0.1),
    ],
)
def test_db_to_lin(db: float, expected: float) -> None:
    assert db_to_lin(db) == pytest.approx(expected, rel=1e-4)


def test_lin_to_db_round_trip() -> None:
    for db in (-30.0, -3.0, 0.0, 7.5, 20.0, 60.0):
        assert lin_to_db(db_to_lin(db)) == pytest.approx(db, abs=1e-9)


def test_lin_to_db_nonpositive() -> None:
    assert lin_to_db(0.0) == float("-inf")
    assert lin_to_db(-1.0) == float("-inf")


def test_dbm_mw_round_trip() -> None:
    for p in (-120.0, -30.0, 0.0, 10.0, 30.0):
        assert mw_to_dbm(dbm_to_mw(p)) == pytest.approx(p, abs=1e-9)


def test_dbm_zero_mw() -> None:
    assert mw_to_dbm(0.0) == float("-inf")


def test_dbm_watts() -> None:
    # 0 dBm = 1 mW = 1e-3 W
    assert dbm_to_w(0.0) == pytest.approx(1e-3)
    # 30 dBm = 1 W
    assert dbm_to_w(30.0) == pytest.approx(1.0)
    assert w_to_dbm(1.0) == pytest.approx(30.0)


def test_noise_factor_round_trip() -> None:
    for nf in (0.0, 0.5, 1.0, 3.0, 10.0):
        assert nf_db_from_noise_factor(noise_factor_from_nf_db(nf)) == pytest.approx(
            nf, abs=1e-9
        )
    assert noise_factor_from_nf_db(None) is None


def test_nf_zero_is_factor_one() -> None:
    assert noise_factor_from_nf_db(0.0) == pytest.approx(1.0)


def test_db_to_lin_matches_math() -> None:
    for db in (-5.3, 2.7, 11.1):
        assert db_to_lin(db) == pytest.approx(math.pow(10, db / 10.0))
