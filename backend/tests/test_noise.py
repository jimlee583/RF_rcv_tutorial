"""Thermal noise, SFDR, and dynamic range sanity checks."""

from __future__ import annotations

import pytest

from app.rf.noise import (
    KTB_DBM_PER_HZ_T0,
    input_power_for_im3_at_noise_floor_dbm,
    mds_dbm,
    sfdr3_db,
    thermal_noise_floor_dbm,
    thermal_noise_power_dbm,
)


def test_ktb_at_290k_is_minus_174() -> None:
    # k T at 290 K in dBm/Hz = -173.975...; textbooks round to -174.
    assert KTB_DBM_PER_HZ_T0 == pytest.approx(-174.0, abs=0.05)


def test_thermal_noise_power_scales_with_bandwidth() -> None:
    # Doubling bandwidth raises noise 3 dB.
    p1 = thermal_noise_power_dbm(1e6)
    p2 = thermal_noise_power_dbm(2e6)
    assert p2 - p1 == pytest.approx(10.0 * 0.30103, abs=1e-4)


def test_thermal_noise_power_scales_with_temperature() -> None:
    # Doubling temperature raises noise 3 dB.
    p290 = thermal_noise_power_dbm(1e6, 290.0)
    p580 = thermal_noise_power_dbm(1e6, 580.0)
    assert p580 - p290 == pytest.approx(10.0 * 0.30103, abs=1e-4)


def test_noise_floor_with_nf() -> None:
    # 1 MHz, NF 0 dB, T=290K  =>  about -174 + 60 = -114 dBm
    nf0 = thermal_noise_floor_dbm(1e6, 0.0)
    assert nf0 == pytest.approx(-114.0, abs=0.05)
    # Add 5 dB NF
    nf5 = thermal_noise_floor_dbm(1e6, 5.0)
    assert nf5 - nf0 == pytest.approx(5.0, abs=1e-9)


def test_thermal_noise_validation() -> None:
    with pytest.raises(ValueError):
        thermal_noise_power_dbm(0.0)
    with pytest.raises(ValueError):
        thermal_noise_power_dbm(1e6, 0.0)


def test_sfdr3_formula() -> None:
    # IIP3 = 0 dBm, N = -120 dBm  =>  SFDR = (2/3)*120 = 80 dB
    assert sfdr3_db(0.0, -120.0) == pytest.approx(80.0)
    # IIP3 = +20 dBm, N = -100 dBm => (2/3)*120 = 80 dB
    assert sfdr3_db(20.0, -100.0) == pytest.approx(80.0)


def test_mds_default_is_noise_floor() -> None:
    assert mds_dbm(-110.0) == pytest.approx(-110.0)
    assert mds_dbm(-110.0, 10.0) == pytest.approx(-100.0)


def test_pin_for_im3_at_noise_floor() -> None:
    # IIP3=0, N=-120 => Pin = (-120 + 0)/3 = -40 dBm
    assert input_power_for_im3_at_noise_floor_dbm(0.0, -120.0) == pytest.approx(-40.0)
