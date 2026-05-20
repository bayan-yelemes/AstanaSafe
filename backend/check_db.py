from app.database import SessionLocal
from app.models.models import TrafficReport, RealAccident
from sqlalchemy import cast, Date
from datetime import date

db = SessionLocal()
target_date = date(2026, 5, 3)

reports = db.query(TrafficReport).filter(cast(TrafficReport.created_at, Date) == target_date).count()
accidents = db.query(RealAccident).count()

print(f"REPORTS_FOR_MAY_3: {reports}")
print(f"TOTAL_HISTORICAL: {accidents}")
db.close()
