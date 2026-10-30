"""IP3 / SFDR curve endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.rf.ip3curve import build_ip3_curve
from app.schemas import Ip3CurveRequest, Ip3CurveResponse

router = APIRouter(prefix="/api", tags=["ip3"])


@router.post("/ip3-curve", response_model=Ip3CurveResponse)
def ip3_curve(req: Ip3CurveRequest) -> Ip3CurveResponse:
    return build_ip3_curve(req)
