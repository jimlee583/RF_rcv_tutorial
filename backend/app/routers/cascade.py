"""Receiver cascade analysis endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.rf.cascade import analyze
from app.schemas import CascadeRequest, CascadeResponse

router = APIRouter(prefix="/api", tags=["cascade"])


@router.post("/cascade/analyze", response_model=CascadeResponse)
def analyze_cascade(req: CascadeRequest) -> CascadeResponse:
    return analyze(
        components=req.components,
        bandwidth_hz=req.bandwidth_hz,
        temperature_k=req.temperature_k,
        source_frequency_hz=req.source_frequency_hz,
    )
