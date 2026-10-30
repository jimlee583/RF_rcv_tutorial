"""Unit conversions used throughout the RF engine.

All power quantities are in dBm externally and in milliwatts (mW)
internally when linear math is required.  Linear gain factors are
dimensionless power ratios.
"""

from __future__ import annotations

import math
from typing import overload


def db_to_lin(db: float) -> float:
    """Convert a dB gain (or NF, as a noise factor power ratio) to linear."""
    return 10.0 ** (db / 10.0)


def lin_to_db(lin: float) -> float:
    """Convert a linear power ratio to dB.

    Values at or below zero are mapped to -inf dB.
    """
    if lin <= 0:
        return float("-inf")
    return 10.0 * math.log10(lin)


def dbm_to_mw(dbm: float) -> float:
    """Convert dBm to milliwatts."""
    return 10.0 ** (dbm / 10.0)


def mw_to_dbm(mw: float) -> float:
    """Convert milliwatts to dBm.  Non-positive power -> -inf dBm."""
    if mw <= 0:
        return float("-inf")
    return 10.0 * math.log10(mw)


def dbm_to_w(dbm: float) -> float:
    """Convert dBm to watts."""
    return dbm_to_mw(dbm) * 1e-3


def w_to_dbm(watts: float) -> float:
    """Convert watts to dBm."""
    return mw_to_dbm(watts * 1e3)


@overload
def noise_factor_from_nf_db(nf_db: float) -> float: ...
@overload
def noise_factor_from_nf_db(nf_db: None) -> None: ...


def noise_factor_from_nf_db(nf_db: float | None) -> float | None:
    """Convert noise figure (dB) to noise factor (linear).  Pass-through for None."""
    if nf_db is None:
        return None
    return db_to_lin(nf_db)


def nf_db_from_noise_factor(f: float) -> float:
    """Convert noise factor (linear) to noise figure in dB."""
    return lin_to_db(f)
