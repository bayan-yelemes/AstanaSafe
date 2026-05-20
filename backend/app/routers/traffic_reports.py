from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import Date, cast

from ..database import get_db
from ..models import models
from ..schemas import schemas
from .auth import get_current_user

router = APIRouter()


@router.post("/traffic-reports", response_model=schemas.TrafficReportOut)
def create_traffic_report(
    payload: schemas.TrafficReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    astana_now = datetime.utcnow() + timedelta(hours=5)

    if payload.report_date:
        selected_day = datetime.strptime(payload.report_date, "%Y-%m-%d")
        created_at = selected_day.replace(
            hour=astana_now.hour,
            minute=astana_now.minute,
            second=astana_now.second,
            microsecond=0,
        )
    else:
        created_at = astana_now

    report = models.TrafficReport(
        lat=payload.lat,
        lng=payload.lng,
        road=payload.road,
        crossroad=payload.crossroad,
        category=payload.category,
        type=payload.type,
        weather=payload.weather,
        duration_minutes=payload.duration_minutes,
        traffic_flow=payload.traffic_flow,
        lanes_blocked=payload.lanes_blocked,
        notes=payload.notes,
        district=payload.district,
        user_name=current_user.full_name or current_user.email or current_user.phone,
        created_at=created_at,
    )

    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/traffic-reports", response_model=list[schemas.TrafficReportOut])
def get_traffic_reports(
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    query = db.query(models.TrafficReport)

    if date:
        try:
            selected_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Date must be in YYYY-MM-DD format",
            )

        query = query.filter(
            cast(models.TrafficReport.created_at, Date) == selected_date
        )

    return query.order_by(models.TrafficReport.created_at.desc()).all()


@router.delete("/traffic-reports/{report_id}")
def delete_traffic_report(
    report_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    report = (
        db.query(models.TrafficReport)
        .filter(models.TrafficReport.id == report_id)
        .first()
    )

    if not report:
        raise HTTPException(status_code=404, detail="Traffic report not found")

    db.delete(report)
    db.commit()

    return {
        "message": "Traffic report deleted successfully",
        "id": report_id,
    }
