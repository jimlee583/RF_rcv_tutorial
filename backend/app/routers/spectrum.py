"""Two-tone RF / IF spectrum endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.rf.spectrum import build_spectrum
from app.schemas import SpectrumRequest, SpectrumResponse

router = APIRouter(prefix="/api", tags=["spectrum"])


@router.post("/spectrum", response_model=SpectrumResponse, response_model_by_alias=True)
def spectrum(req: SpectrumRequest) -> SpectrumResponse:
    return build_spectrum(req)
