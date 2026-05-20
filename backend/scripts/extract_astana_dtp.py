import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILE = BASE_DIR / "data" / "ДТП.geojson"
OUTPUT_FILE = BASE_DIR / "data" / "astana_dtp.geojson"

# Примерный bounding box Астаны
MIN_LON = 70.8
MAX_LON = 71.8
MIN_LAT = 50.8
MAX_LAT = 51.5

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    astana_features = []

    for feature in data.get("features", []):
        coords = feature.get("geometry", {}).get("coordinates", [])
        if not coords or len(coords) < 2:
            continue

        lon, lat = coords[0], coords[1]

        if MIN_LON <= lon <= MAX_LON and MIN_LAT <= lat <= MAX_LAT:
            astana_features.append(feature)

    result = {
        "type": "FeatureCollection",
        "features": astana_features,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"Saved {len(astana_features)} records to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()