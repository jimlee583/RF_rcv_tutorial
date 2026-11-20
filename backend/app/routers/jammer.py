"""Jammer impact endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.rf.jammer import build_jammer
from app.schemas import JammerRequest, JammerResponse

router = APIRouter(prefix="/api", tags=["jammer"])


@router.post("/jammer", response_model=JammerResponse)
def jammer(req: JammerRequest) -> JammerResponse:
    return build_jammer(req)
