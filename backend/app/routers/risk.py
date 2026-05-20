from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.risk_analysis import DEFAULT_RADIUS_M, MAX_RADIUS_M, MIN_RADIUS_M, analyze_zone

router = APIRouter(prefix="/risk", tags=["risk-analysis"])


@router.get("/analyze")
def analyze_risk_zone(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(DEFAULT_RADIUS_M, ge=MIN_RADIUS_M, le=MAX_RADIUS_M),
    date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return analyze_zone(db=db, lat=lat, lng=lng, radius_m=radius_m, date=date)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk analysis failed: {exc}") from exc
