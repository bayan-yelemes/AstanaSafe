from random import choice, randint, uniform, seed
from datetime import datetime, timedelta

from app.database import SessionLocal, engine, Base
from app.models.models import District, Accident

Base.metadata.create_all(bind=engine)

seed(42)
db = SessionLocal()

# Clear old data first
db.query(Accident).delete()
db.query(District).delete()
db.commit()

district_names = ["Esil", "Almaty", "Saryarka", "Nura"]

for name in district_names:
    db.add(District(name=name))

db.commit()

districts = db.query(District).all()
district_map = {d.name: d.id for d in districts}

# Approximate coordinate zones by district
district_coords = {
    "Esil": {
        "lat": (51.100, 51.160),
        "lng": (71.380, 71.470),
    },
    "Almaty": {
        "lat": (51.160, 51.210),
        "lng": (71.430, 71.520),
    },
    "Saryarka": {
        "lat": (51.150, 51.210),
        "lng": (71.320, 71.410),
    },
    "Nura": {
        "lat": (51.080, 51.140),
        "lng": (71.350, 71.450),
    },
}

accident_types = ["collision", "pedestrian", "rollover"]
severities = ["low", "medium", "high"]
weather_options = ["clear", "rain", "snow", "ice"]

descriptions = {
    "collision": [
        "Two-car collision near a major intersection.",
        "Minor collision during peak traffic.",
        "Rear-end accident reported on avenue.",
    ],
    "pedestrian": [
        "Pedestrian crossing incident.",
        "Incident near bus stop area.",
        "Pedestrian accident at signalized crossing.",
    ],
    "rollover": [
        "Vehicle rollover due to sharp maneuver.",
        "Rollover incident on slippery road.",
        "Loss of control caused rollover.",
    ],
}

# Generate data across many dates in April 2026
base_date = datetime(2026, 4, 1, 8, 0, 0)

all_accidents = []

for day_offset in range(30):  # April 1 to April 30
    current_day = base_date + timedelta(days=day_offset)

    # Vary intensity by weekday
    weekday = current_day.weekday()  # Mon=0 ... Sun=6
    if weekday == 0:         # Monday
        accidents_today = randint(10, 16)
    elif weekday == 4:       # Friday
        accidents_today = randint(9, 14)
    elif weekday in [5, 6]:  # Weekend
        accidents_today = randint(4, 8)
    else:
        accidents_today = randint(6, 11)

    for _ in range(accidents_today):
        district = choice(district_names)
        coords = district_coords[district]

        accident_type = choice(accident_types)

        # Make severity depend a bit on weather
        weather = choice(weather_options)
        if weather in ["snow", "ice"]:
            severity = choice(["medium", "high", "high", "low"])
        else:
            severity = choice(severities)

        accident_time = current_day.replace(
            hour=randint(6, 22),
            minute=randint(0, 59),
            second=0,
        )

        lat = round(uniform(*coords["lat"]), 6)
        lng = round(uniform(*coords["lng"]), 6)

        description = choice(descriptions[accident_type])

        all_accidents.append(
            Accident(
                latitude=lat,
                longitude=lng,
                date=accident_time,
                type=accident_type,
                severity=severity,
                weather=weather,
                district_id=district_map[district],
                description=description,
            )
        )

db.add_all(all_accidents)
db.commit()
db.close()

print(f"Inserted {len(all_accidents)} accidents.")