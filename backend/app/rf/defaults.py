"""Illustrative default receiver configuration.

These numbers are intentionally representative of a plausible 2 GHz
down-converting receiver but do NOT correspond to any specific real part.
The ``illustrative`` flag on the config is True.
"""

from __future__ import annotations

from app.schemas import (
    AmplifierComponent,
    AttenuatorComponent,  # noqa: F401 - re-exported for completeness
    FilterComponent,
    LnaComponent,
    MixerComponent,
    ReceiverConfig,
)


def default_receiver() -> ReceiverConfig:
    return ReceiverConfig(
        name="Example 2 GHz downconverter",
        description=(
            "Illustrative wideband satcom-style downconverter: RF preselect "
            "filter, low-noise amp, mixer to 100 MHz IF, IF filter, IF amp."
        ),
        bandwidth_hz=1_000_000.0,
        temperature_k=290.0,
        source_frequency_hz=2.1e9,
        illustrative=True,
        components=[
            FilterComponent(
                id="rf_filter",
                name="RF preselect filter",
                insertion_loss_db=1.0,
                passband_min_hz=2.0e9,
                passband_max_hz=2.2e9,
                stopband_rejection_db=50.0,
                freq_min_hz=2.0e9,
                freq_max_hz=2.2e9,
                notes="Illustrative BAW/cavity filter.",
            ),
            LnaComponent(
                id="lna",
                name="LNA",
                gain_db=20.0,
                nf_db=1.0,
                oip3_dbm=30.0,
                op1db_dbm=18.0,
                freq_min_hz=1.8e9,
                freq_max_hz=2.4e9,
                notes="Illustrative wideband LNA.",
            ),
            MixerComponent(
                id="mixer",
                name="Downconverting mixer",
                conversion_gain_db=-7.0,
                nf_db=7.0,
                iip3_dbm=15.0,
                ip1db_in_dbm=5.0,
                lo_frequency_hz=2.0e9,
                sideband="lower",
                lo_power_dbm=7.0,
                lo_rf_isolation_db=25.0,
                freq_min_hz=0.5e9,
                freq_max_hz=3.0e9,
                notes="Illustrative double-balanced diode mixer.",
            ),
            FilterComponent(
                id="if_filter",
                name="IF filter",
                insertion_loss_db=2.0,
                passband_min_hz=70e6,
                passband_max_hz=130e6,
                stopband_rejection_db=60.0,
                freq_min_hz=50e6,
                freq_max_hz=150e6,
                notes="Illustrative 100 MHz IF SAW filter.",
            ),
            AmplifierComponent(
                id="if_amp",
                name="IF amplifier",
                gain_db=30.0,
                nf_db=3.0,
                oip3_dbm=35.0,
                op1db_dbm=22.0,
                freq_min_hz=10e6,
                freq_max_hz=500e6,
                notes="Illustrative IF gain block.",
            ),
        ],
    )
