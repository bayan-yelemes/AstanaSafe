"""Import Astana road accident GeoJSON into the configured database."""

import json
from pathlib import Path

from app.database import SessionLocal, engine, Base
from app.models.models import RealAccident

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILE = BASE_DIR / "data" / "astana_dtp.geojson"

Base.metadata.create_all(bind=engine)

def normalize_severity(accident_type: str | None) -> str:
    if not accident_type:
        return "low"

    text = str(accident_type).lower()

    if "fatal" in text or "death" in text:
        return "high"
    if "injury" in text or "rollover" in text:
        return "medium"

    return "low"

def normalize_weather(road_condition: str | None) -> str:
    if not road_condition:
        return "unknown"

    text = str(road_condition).lower()

    if "snow" in text or "снег" in text or "снеж" in text:
        return "snow"
    if "ice" in text or "лед" in text or "голол" in text:
        return "ice"
    if "rain" in text or "дожд" in text:
        return "rain"
    if "dry" in text or "сух" in text:
        return "clear"

    return "unknown"

def build_description(props: dict) -> str:
    accident_type = props.get("type_dtp") or "Unknown accident"
    road_condition = props.get("fd1r07p1") or "Unknown road condition"
    area_code = props.get("area_code") or "Unknown area"
    return f"{accident_type}. Road condition: {road_condition}. Area code: {area_code}."

def main():
    db = SessionLocal()

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    inserted = 0
    skipped = 0

    for index, feature in enumerate(features):
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})
        coords = geometry.get("coordinates", [])

        if not coords or len(coords) < 2:
            skipped += 1
            continue

        lon, lat = coords[0], coords[1]

        source_id = str(props.get("gid") or props.get("id") or index)

        existing = db.query(RealAccident).filter(RealAccident.source_id == source_id).first()
        if existing:
            skipped += 1
            continue

        accident_type = props.get("type_dtp")
        road_condition = props.get("fd1r07p1")
        accident_date_raw = props.get("rta_date")
        year_raw = props.get("yr")
        area_code = props.get("area_code")

        try:
            year = int(year_raw) if year_raw is not None else None
        except Exception:
            year = None

        item = RealAccident(
            source_id=source_id,
            latitude=float(lat),
            longitude=float(lon),
            accident_date_raw=str(accident_date_raw) if accident_date_raw else None,
            year=year,
            area_code=str(area_code) if area_code is not None else None,
            accident_type=str(accident_type) if accident_type else None,
            road_condition=str(road_condition) if road_condition else None,
            district=None,
            weather=normalize_weather(road_condition),
            severity=normalize_severity(accident_type),
            description=build_description(props),
        )

        db.add(item)
        inserted += 1

        if inserted % 1000 == 0:
            db.commit()
            print(f"Inserted {inserted} records...")

    db.commit()
    db.close()

    print(f"Done. Inserted: {inserted}, skipped: {skipped}")

if __name__ == "__main__":
    main()
