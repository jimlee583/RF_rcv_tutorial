"""Fundamental and IM3 power curves for the IP3 / SFDR plot.

All traces are the standard two-tone small-signal extrapolation:

    P_fund,out (dBm) = Pin + G
    P_IM3,out  (dBm) = 3 Pin + G - 2 IIP3

The two lines meet at the extrapolated intercept (IIP3, OIP3), with
OIP3 = IIP3 + G.  That intercept is not a saturation power; the cubic
model is only quoted in the small-signal region, taken here as Pin at
or below the supplied input P1dB, or IIP3 − 10 dB when P1dB is unknown.

Third-order SFDR is the input span from the noise floor N = kTB + NF
to the Pin at which IM3 equals N:

    SFDR3 = (2/3) (IIP3 − N)
    Pin | IM3 = N  = (N + 2 IIP3) / 3
"""

from __future__ import annotations

from typing import Literal

import numpy as np

from app.rf.noise import (
    input_power_for_im3_at_noise_floor_dbm,
    sfdr3_db,
    thermal_noise_floor_dbm,
)
from app.schemas import Ip3CurvePoint, Ip3CurveRequest, Ip3CurveResponse

# Conventional margin: many amplifiers have IP1dB ≈ IIP3 − 9 to −12 dB.
# Used only when the caller has not supplied an input P1dB.
SMALL_SIGNAL_MARGIN_DB = 10.0


def fundamental_out_dbm(pin_dbm: float, gain_db: float) -> float:
    """Linear fundamental: 1 dB of output per 1 dB of input."""
    return pin_dbm + gain_db


def im3_out_dbm(pin_dbm: float, iip3_dbm: float, gain_db: float) -> float:
    """Equal-tone two-tone IM3 referred to the output.

    P_IM3,in = 3 Pin − 2 IIP3, then add G.  Equivalently
    3 (Pin + G) − 2 OIP3 with OIP3 = IIP3 + G.
    """
    return 3.0 * pin_dbm + gain_db - 2.0 * iip3_dbm


def valid_region_max_dbm(
    iip3_dbm: float, ip1db_in_dbm: float | None
) -> tuple[float, Literal["ip1db", "iip3_minus_10"]]:
    """Upper Pin of the trustworthy (non-extrapolated) region."""
    if ip1db_in_dbm is not None:
        return float(ip1db_in_dbm), "ip1db"
    return float(iip3_dbm - SMALL_SIGNAL_MARGIN_DB), "iip3_minus_10"


def default_pin_max_dbm(iip3_dbm: float) -> float:
    """Default sweep end: a little past the intercept so it is on-screen."""
    return float(iip3_dbm + 10.0)


def build_ip3_curve(req: Ip3CurveRequest) -> Ip3CurveResponse:
    """Build the Pout-vs-Pin traces and the SFDR / intercept annotations."""
    pin_min = float(req.pin_min_dbm)
    pin_max = (
        float(req.pin_max_dbm)
        if req.pin_max_dbm is not None
        else default_pin_max_dbm(req.iip3_dbm)
    )
    if pin_max <= pin_min:
        pin_max = pin_min + 40.0

    noise_in = thermal_noise_floor_dbm(
        req.bandwidth_hz, req.nf_db, req.temperature_k
    )
    noise_out = noise_in + req.gain_db
    oip3 = req.iip3_dbm + req.gain_db
    sfdr = sfdr3_db(req.iip3_dbm, noise_in)
    pin_im3_eq_n = input_power_for_im3_at_noise_floor_dbm(req.iip3_dbm, noise_in)
    valid_max, valid_source = valid_region_max_dbm(req.iip3_dbm, req.ip1db_in_dbm)

    pins = np.linspace(pin_min, pin_max, int(req.num_points))
    points = [
        Ip3CurvePoint(
            pin_dbm=float(pin),
            fundamental_out_dbm=float(fundamental_out_dbm(pin, req.gain_db)),
            im3_out_dbm=float(im3_out_dbm(pin, req.iip3_dbm, req.gain_db)),
        )
        for pin in pins
    ]

    return Ip3CurveResponse(
        points=points,
        iip3_dbm=req.iip3_dbm,
        oip3_dbm=oip3,
        noise_floor_in_dbm=noise_in,
        noise_floor_out_dbm=noise_out,
        sfdr3_db=sfdr,
        pin_at_im3_eq_noise_dbm=pin_im3_eq_n,
        valid_region_max_dbm=valid_max,
        valid_region_source=valid_source,
        gain_db=req.gain_db,
    )
