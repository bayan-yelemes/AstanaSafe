from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, Date, cast
from typing import Optional
from ..database import get_db
from ..models import models
from ..schemas.schemas import AccidentOut

router = APIRouter()

@router.get("/", response_model=list[AccidentOut])
def get_accidents(
    district: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    weather: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Accident)

    if district:
        query = query.join(models.District).filter(models.District.name == district)
    if type:
        query = query.filter(models.Accident.type == type)
    if weather:
        query = query.filter(models.Accident.weather == weather)
    if date:
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(cast(models.Accident.date, Date) == date_obj)
        except Exception:
            pass

    return query.all()


@router.get("/heatmap")
def get_heatmap_data(
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Accident)

    if date:
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(cast(models.Accident.date, Date) == date_obj)
        except Exception:
            pass

    accidents = query.all()

    return [
        {
            "lat": a.latitude,
            "lng": a.longitude,
            "weight": 3 if a.severity == "high" else 2 if a.severity == "medium" else 1
        }
        for a in accidents
    ]