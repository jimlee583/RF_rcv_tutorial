"""Mixer frequency conversion, IM product frequencies and spur enumeration."""

from __future__ import annotations

import pytest

from app.rf.mixer import (
    convert_frequency,
    illustrative_spur_suppression_dbc,
    im2_frequencies,
    im3_frequencies,
    image_frequency,
    lo_harmonic_frequencies,
    lo_harmonic_suppression_dbc,
    mixer_spur_products,
)

F1 = 2.09e9
F2 = 2.11e9
LO = 2.00e9


def test_spec_default_rf_im3_frequencies() -> None:
    # 2.09 / 2.11 GHz tones => IM3 at 2.07 and 2.13 GHz
    lo, hi = im3_frequencies(F1, F2)
    assert lo == pytest.approx(2.07e9)
    assert hi == pytest.approx(2.13e9)


def test_im3_frequencies_order_independent() -> None:
    assert sorted(im3_frequencies(F1, F2)) == sorted(im3_frequencies(F2, F1))


def test_im2_frequencies() -> None:
    diff, total = im2_frequencies(F1, F2)
    assert diff == pytest.approx(20e6)
    assert total == pytest.approx(4.20e9)


def test_spec_default_if_frequencies() -> None:
    # Desired IF: 90 and 110 MHz; IM3 at IF: 70 and 130 MHz.
    assert convert_frequency(F1, LO, "lower") == pytest.approx(90e6)
    assert convert_frequency(F2, LO, "lower") == pytest.approx(110e6)
    assert convert_frequency(2.07e9, LO, "lower") == pytest.approx(70e6)
    assert convert_frequency(2.13e9, LO, "lower") == pytest.approx(130e6)


def test_lower_sideband_is_absolute_difference() -> None:
    # LO above the RF (high-side injection) still gives a positive IF.
    assert convert_frequency(1.9e9, LO, "lower") == pytest.approx(100e6)


def test_upper_sideband_is_sum() -> None:
    assert convert_frequency(100e6, LO, "upper") == pytest.approx(2.1e9)


def test_image_frequency() -> None:
    # 2.1 GHz with a 2.0 GHz LO => image at 1.9 GHz, both land at 100 MHz.
    img = image_frequency(2.1e9, LO, "lower")
    assert img == pytest.approx(1.9e9)
    assert convert_frequency(img, LO, "lower") == pytest.approx(100e6)
    assert image_frequency(2.1e9, LO, "upper") is None


def test_lo_harmonics() -> None:
    assert lo_harmonic_frequencies(LO, 3) == pytest.approx([2e9, 4e9, 6e9])


def test_lo_harmonic_suppression_pattern() -> None:
    assert lo_harmonic_suppression_dbc(1) == 0.0
    # Odd harmonics of a square-wave LO fall as 20*log10(n).
    assert lo_harmonic_suppression_dbc(3) == pytest.approx(9.54, abs=0.01)
    # Even harmonics are additionally balanced out.
    assert lo_harmonic_suppression_dbc(2) > lo_harmonic_suppression_dbc(3)


def test_illustrative_spur_table_shape() -> None:
    assert illustrative_spur_suppression_dbc(1, 1) == 0.0
    assert illustrative_spur_suppression_dbc(0, 0) is None
    assert illustrative_spur_suppression_dbc(0, 2) is None  # pure LO handled elsewhere
    # Higher RF order => more suppression.
    assert illustrative_spur_suppression_dbc(3, 1) > illustrative_spur_suppression_dbc(2, 1)
    # Feedthrough is finite.
    assert illustrative_spur_suppression_dbc(1, 0) is not None


def test_spur_products_exclude_desired_and_include_other_sideband() -> None:
    spurs = mixer_spur_products(F1, LO, "lower", max_order=2)
    freqs = {round(s.frequency_hz) for s in spurs}
    # Desired 90 MHz must not be present.
    assert round(90e6) not in freqs
    # Sum product (other sideband) at 4.09 GHz present, non-illustrative, 0 dBc.
    other = next(s for s in spurs if s.m == 1 and s.n == 1)
    assert other.frequency_hz == pytest.approx(4.09e9)
    assert other.suppression_dbc == 0.0
    assert other.illustrative is False
    # Everything else is illustrative in the default model.
    assert all(s.illustrative for s in spurs if not (s.m == 1 and s.n == 1))
    # Classic 2x2 product at |2*2.09 - 2*2.00| = 180 MHz is enumerated.
    assert round(180e6) in freqs


def test_spur_products_with_measured_table() -> None:
    table = {(2, 1): 60.0}
    spurs = mixer_spur_products(F1, LO, "lower", max_order=3, spur_table=table)
    non_sideband = [s for s in spurs if not (s.m == 1 and s.n == 1)]
    assert non_sideband, "table entry should be produced"
    assert all((s.m, s.n) == (2, 1) for s in non_sideband)
    assert all(s.suppression_dbc == 60.0 and s.illustrative is False for s in non_sideband)
