"""Prepare the production database before the web server starts."""

from pathlib import Path

from app.database import SessionLocal
from app.models.models import RealAccident

from scripts.migrate_database import main as migrate_database

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILE = BASE_DIR / "data" / "astana_dtp.geojson"


def has_real_accidents() -> bool:
    db = SessionLocal()
    try:
        return db.query(RealAccident.id).limit(1).first() is not None
    finally:
        db.close()


def main() -> None:
    migrate_database()

    if has_real_accidents():
        print("Real accident data already exists; skipping import.")
        return

    if not INPUT_FILE.exists():
        print(f"Real accident import file is missing: {INPUT_FILE}")
        return

    print(f"Importing real accident data from {INPUT_FILE}...")
    from scripts.import_astana_dtp_to_db import main as import_real_accidents

    import_real_accidents()


if __name__ == "__main__":
    main()
