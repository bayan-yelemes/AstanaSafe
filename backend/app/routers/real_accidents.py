from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models.models import RealAccident
from ..schemas.schemas import RealAccidentOut

router = APIRouter()


@router.get("/real-accidents", response_model=list[RealAccidentOut])
def get_real_accidents(
    year: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    weather: Optional[str] = Query(None),
    limit: int = Query(500),
    db: Session = Depends(get_db),
):
    query = db.query(RealAccident)

    if year is not None:
        query = query.filter(RealAccident.year == year)

    if severity:
        query = query.filter(RealAccident.severity == severity)

    if weather:
        query = query.filter(RealAccident.weather == weather)

    return query.limit(limit).all()