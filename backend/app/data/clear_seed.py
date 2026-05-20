from app.database import SessionLocal
from app.models.models import Accident, District

db = SessionLocal()

db.query(Accident).delete()
db.query(District).delete()

db.commit()
db.close()

print("Seed data removed.")