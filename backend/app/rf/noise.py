"""Thermal noise, noise floor, dynamic range helpers.

Equations:
    kTB (W)    = k * T * B
    kTB (dBm)  = 10*log10(k*T*B * 1000)
    N (dBm)    = 10*log10(k*T*B * 1000) + NF
    SFDR3 (dB) = (2/3) * (IIP3 - N)

At T = 290 K, k*T = 4.0038e-21 J => k*T in dBm/Hz = -173.976 dBm/Hz
(the usual "-174 dBm/Hz" figure).
"""

from __future__ import annotations

import math

BOLTZMANN_J_PER_K = 1.380649e-23  # SI value
T0_K = 290.0  # IEEE reference temperature
KTB_DBM_PER_HZ_T0 = 10.0 * math.log10(BOLTZMANN_J_PER_K * T0_K * 1e3)  # ~ -173.975


def thermal_noise_power_dbm(bandwidth_hz: float, temperature_k: float = T0_K) -> float:
    """Thermal input noise power in dBm (no receiver NF applied).

    k * T * B in watts, then converted to dBm.
    """
    if bandwidth_hz <= 0:
        raise ValueError("bandwidth_hz must be > 0")
    if temperature_k <= 0:
        raise ValueError("temperature_k must be > 0")
    power_watts = BOLTZMANN_J_PER_K * temperature_k * bandwidth_hz
    return 10.0 * math.log10(power_watts * 1e3)


def thermal_noise_floor_dbm(
    bandwidth_hz: float,
    nf_db: float,
    temperature_k: float = T0_K,
) -> float:
    """Input-referred receiver noise floor:  kTB + NF, in dBm."""
    return thermal_noise_power_dbm(bandwidth_hz, temperature_k) + nf_db


def sfdr3_db(iip3_dbm: float, noise_floor_dbm: float) -> float:
    """Third-order spurious-free dynamic range.

    SFDR3 = (2/3) * (IIP3 - N).  Both inputs in dBm, result in dB.
    Assumes two-tone small-signal model with in-band third-order products.
    """
    return (2.0 / 3.0) * (iip3_dbm - noise_floor_dbm)


def mds_dbm(noise_floor_dbm: float, snr_min_db: float = 0.0) -> float:
    """Minimum discernible signal (dBm) for a given detection SNR."""
    return noise_floor_dbm + snr_min_db


def compression_dynamic_range_db(ip1db_in_dbm: float, noise_floor_dbm: float) -> float:
    """Compression-limited dynamic range: input P1dB above noise floor."""
    return ip1db_in_dbm - noise_floor_dbm


def input_power_for_im3_at_noise_floor_dbm(
    iip3_dbm: float, noise_floor_dbm: float
) -> float:
    """Input power at which a two-tone IM3 product equals the noise floor.

    From P_IM3 (in) = 3 Pin - 2 IIP3  =>  Pin = (N + 2 IIP3) / 3.
    """
    return (noise_floor_dbm + 2.0 * iip3_dbm) / 3.0
