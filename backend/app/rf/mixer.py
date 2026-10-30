"""Mixer frequency conversion, intermodulation frequencies, and spur tables.

Frequency math here is exact.  Spur *levels* are not: unless the caller
supplies a measured spur table, the levels come from a simple illustrative
model (see :func:`illustrative_spur_suppression_dbc`) and every product it
produces is flagged ``illustrative=True`` downstream.

Conventions:
    * "lower" sideband  => f_if = |f_rf - f_lo|   (standard downconversion)
    * "upper" sideband  => f_if =  f_rf + f_lo
    * A mixer spur of order (m, n) sits at |m*f_rf +/- n*f_lo|.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

Sideband = Literal["lower", "upper"]

# Illustrative LO / isolation defaults used when the caller gives none.
DEFAULT_LO_POWER_DBM = 7.0
DEFAULT_LO_RF_ISOLATION_DB = 25.0
DEFAULT_LO_IF_ISOLATION_DB = 25.0
DEFAULT_RF_IF_ISOLATION_DB = 25.0


# ---------------------------------------------------------------------------
# Frequency conversion
# ---------------------------------------------------------------------------


def convert_frequency(f_rf_hz: float, lo_hz: float, sideband: Sideband = "lower") -> float:
    """Desired-sideband output frequency of an ideal mixer."""
    if sideband == "upper":
        return f_rf_hz + lo_hz
    return abs(f_rf_hz - lo_hz)


def image_frequency(f_rf_hz: float, lo_hz: float, sideband: Sideband = "lower") -> float | None:
    """RF frequency that converts to the same IF as ``f_rf_hz``.

    For lower-sideband conversion the image is mirrored about the LO:
    f_img = 2*f_lo - f_rf.  Upper-sideband (sum) conversion has no
    positive-frequency image, so None is returned.
    """
    if sideband == "upper":
        return None
    img = 2.0 * lo_hz - f_rf_hz
    return img if img > 0 else None


def im3_frequencies(f1_hz: float, f2_hz: float) -> tuple[float, float]:
    """Third-order two-tone products: (2*f1 - f2, 2*f2 - f1)."""
    return (abs(2.0 * f1_hz - f2_hz), abs(2.0 * f2_hz - f1_hz))


def im2_frequencies(f1_hz: float, f2_hz: float) -> tuple[float, float]:
    """Second-order two-tone products: (|f2 - f1|, f1 + f2)."""
    return (abs(f2_hz - f1_hz), f1_hz + f2_hz)


def lo_harmonic_frequencies(lo_hz: float, max_order: int) -> list[float]:
    """[f_lo, 2*f_lo, ..., max_order*f_lo]."""
    return [n * lo_hz for n in range(1, max_order + 1)]


# ---------------------------------------------------------------------------
# Spur levels
# ---------------------------------------------------------------------------


def lo_harmonic_suppression_dbc(n: int) -> float:
    """Illustrative level of the n-th LO harmonic relative to the fundamental.

    A diode mixer is driven hard enough that the LO port behaves roughly like
    a square wave: odd harmonics fall as 1/n in amplitude (20*log10(n) dB),
    even harmonics are suppressed by the mixer's balance (taken as 35 dB on
    top of the 1/n roll-off).  These are typical magnitudes, not a datasheet.
    """
    if n <= 1:
        return 0.0
    base = 20.0 * math.log10(n)
    return base if n % 2 == 1 else base + 35.0


def illustrative_spur_suppression_dbc(m: int, n: int) -> float | None:
    """Illustrative suppression of the (m x RF, n x LO) product below the
    desired (1, 1) output, in dB.

    Returns None for combinations the model does not describe (m = n = 0,
    or the desired product itself).

    Model:
        * RF harmonic order m >= 2 adds a large penalty (the RF port is in
          its small-signal region): 45 dB for m = 2, +10 dB per further order.
        * LO harmonic order n follows :func:`lo_harmonic_suppression_dbc`.
        * n = 0 (RF feedthrough) uses an RF-to-IF isolation figure.
    """
    if m == 0 and n == 0:
        return None
    if m == 1 and n == 1:
        return 0.0
    if m == 0:
        # Pure LO products are handled separately as LO leakage / harmonics.
        return None
    rf_part = 0.0 if m == 1 else 45.0 + 10.0 * (m - 2)
    if n == 0:
        return rf_part + DEFAULT_RF_IF_ISOLATION_DB
    return rf_part + lo_harmonic_suppression_dbc(n)


@dataclass(frozen=True)
class SpurProduct:
    m: int
    n: int
    sign: int  # +1 for m*f_rf + n*f_lo, -1 for |m*f_rf - n*f_lo|
    frequency_hz: float
    suppression_dbc: float
    illustrative: bool

    @property
    def label(self) -> str:
        if self.n == 0:
            return f"{self.m}RF feedthrough" if self.m > 1 else "RF feedthrough"
        op = "+" if self.sign > 0 else "-"
        return f"{self.m}RF {op} {self.n}LO"


def mixer_spur_products(
    f_rf_hz: float,
    lo_hz: float,
    sideband: Sideband,
    max_order: int,
    spur_table: dict[tuple[int, int], float] | None = None,
) -> list[SpurProduct]:
    """Enumerate (m x RF) +/- (n x LO) products for one RF tone.

    The desired product is excluded.  The *other* sideband of the (1, 1)
    product (e.g. f_rf + f_lo for a downconverter) is included at 0 dBc
    because a real mixer produces both sum and difference at equal level;
    that one is not illustrative.

    ``spur_table`` maps (m, n) -> suppression_dbc.  If given, only listed
    combinations are produced and they are flagged non-illustrative.
    """
    out: list[SpurProduct] = []
    desired_sign = 1 if sideband == "upper" else -1
    for m in range(1, max_order + 1):
        for n in range(0, max_order + 1):
            signs = (1,) if n == 0 else (1, -1)
            for sign in signs:
                if m == 1 and n == 1 and sign == desired_sign:
                    continue  # the wanted output
                f = abs(m * f_rf_hz + sign * n * lo_hz)
                if f <= 0:
                    continue
                if m == 1 and n == 1:
                    out.append(
                        SpurProduct(
                            m=m, n=n, sign=sign, frequency_hz=f,
                            suppression_dbc=0.0, illustrative=False,
                        )
                    )
                    continue
                if spur_table is not None:
                    if (m, n) not in spur_table:
                        continue
                    supp = spur_table[(m, n)]
                    illustrative = False
                else:
                    maybe = illustrative_spur_suppression_dbc(m, n)
                    if maybe is None:
                        continue
                    supp = maybe
                    illustrative = True
                out.append(
                    SpurProduct(
                        m=m, n=n, sign=sign, frequency_hz=f,
                        suppression_dbc=supp, illustrative=illustrative,
                    )
                )
    return out
