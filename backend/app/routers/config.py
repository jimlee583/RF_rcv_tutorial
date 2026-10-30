"""Default receiver config and component templates."""

from __future__ import annotations

from fastapi import APIRouter

from app.rf.defaults import default_receiver
from app.schemas import (
    AmplifierComponent,
    AttenuatorComponent,
    FilterComponent,
    LnaComponent,
    MixerComponent,
    ReceiverConfig,
)

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/defaults", response_model=ReceiverConfig)
def get_defaults() -> ReceiverConfig:
    return default_receiver()


@router.get("/component-templates")
def get_component_templates() -> dict[str, dict]:
    """Return one blank-ish example per component type for the UI 'Add' menu."""
    return {
        "amplifier": AmplifierComponent(
            id="new_amplifier",
            name="Amplifier",
            gain_db=15.0,
            nf_db=4.0,
            oip3_dbm=25.0,
            op1db_dbm=15.0,
        ).model_dump(),
        "lna": LnaComponent(
            id="new_lna",
            name="LNA",
            gain_db=20.0,
            nf_db=1.0,
            oip3_dbm=30.0,
            op1db_dbm=18.0,
        ).model_dump(),
        "filter": FilterComponent(
            id="new_filter",
            name="Filter",
            insertion_loss_db=1.5,
            passband_min_hz=1.9e9,
            passband_max_hz=2.1e9,
            stopband_rejection_db=40.0,
        ).model_dump(),
        "attenuator": AttenuatorComponent(
            id="new_attenuator",
            name="Attenuator",
            attenuation_db=3.0,
        ).model_dump(),
        "mixer": MixerComponent(
            id="new_mixer",
            name="Mixer",
            conversion_gain_db=-7.0,
            nf_db=7.0,
            iip3_dbm=15.0,
            ip1db_in_dbm=5.0,
            lo_frequency_hz=2.0e9,
            sideband="lower",
        ).model_dump(),
    }
