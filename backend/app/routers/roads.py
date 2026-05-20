from fastapi import APIRouter, Query, HTTPException
import json
import os
import math

router = APIRouter(prefix="/roads", tags=["roads"])


def load_streets_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    file_path = os.path.join(base_dir, "astana_streets.json")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    streets = data.get("streets", [])
    return streets


def load_intersections_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    file_path = os.path.join(base_dir, "astana_intersections.json")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return data


def normalize_name(value: str) -> str:
    return str(value or "").strip()


@router.get("/streets")
def get_streets():
    try:
        streets_data = load_streets_data()

        cleaned = []
        seen = set()

        for item in streets_data:
            if isinstance(item, dict):
                name = normalize_name(item.get("name"))
            else:
                name = normalize_name(item)

            if not name:
                continue

            key = name.lower()
            if key in seen:
                continue

            seen.add(key)
            cleaned.append(name)

        cleaned.sort(key=lambda x: x.lower())

        return {"streets": cleaned}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load streets: {str(e)}"
        )


@router.get("/intersections")
def get_intersections(street: str = Query(...)):
    try:
        data = load_intersections_data()

        def normalize_search_text(value: str) -> str:
            text = normalize_name(value).lower()

            replacements = {
                "ё": "е",
                "ұ": "у",
                "ү": "у",
                "қ": "к",
                "ң": "н",
                "ғ": "г",
                "һ": "х",
                "і": "и",
            }

            for src, dst in replacements.items():
                text = text.replace(src, dst)

            for token in [
                "проспект",
                "пр-т",
                "пр.",
                "даңғылы",
                "даң.",
                "көшесі",
                "көш.",
                "улица",
                "ул.",
                "переулок",
                "пер.",
                "проезд",
                "шоссе",
            ]:
                text = text.replace(token, " ")

            text = " ".join(text.split())
            return text

        search = normalize_search_text(street)

        matched_items = []
        matched_keys = []

        for key, raw_items in data.items():
            normalized_key = normalize_search_text(key)

            if not normalized_key:
                continue

            if (
                search == normalized_key
                or search in normalized_key
                or normalized_key in search
            ):
                matched_keys.append(key)
                matched_items.extend(raw_items)

        if not matched_items:
            return {"street": street, "intersections": []}

        cleaned = []
        seen = set()
        selected_street_normalized = normalize_search_text(street)

        for item in matched_items:
            crossroad = normalize_name(item.get("crossroad"))
            if not crossroad:
                continue

            crossroad_normalized = normalize_search_text(crossroad)

            if crossroad_normalized == selected_street_normalized:
                continue

            try:
                lat = float(item["lat"])
                lng = float(item["lng"])
            except (KeyError, TypeError, ValueError):
                continue

            key = crossroad_normalized
            if key in seen:
                continue

            seen.add(key)
            cleaned.append({
                "crossroad": crossroad,
                "lat": lat,
                "lng": lng,
            })

        cleaned.sort(key=lambda x: x["crossroad"].lower())

        return {
            "street": matched_keys[0] if matched_keys else street,
            "intersections": cleaned
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load intersections: {str(e)}"
        )


@router.get("/districts")
def get_districts():
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        file_path = os.path.join(base_dir, "astana_districts.geojson")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return data

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load districts: {str(e)}"
        )


@router.get("/nearest-location")
def get_nearest_location(
    lat: float = Query(...),
    lng: float = Query(...)
):
    try:
        data = load_intersections_data()

        nearest = None
        min_distance = float("inf")

        for road, intersections in data.items():
            for item in intersections:
                item_lat = item.get("lat")
                item_lng = item.get("lng")
                crossroad = normalize_name(item.get("crossroad"))

                if item_lat is None or item_lng is None:
                    continue

                distance = math.sqrt(
                    (lat - float(item_lat)) ** 2 + (lng - float(item_lng)) ** 2
                )

                if distance < min_distance:
                    min_distance = distance
                    nearest = {
                        "road": road,
                        "crossroad": crossroad,
                        "lat": float(item_lat),
                        "lng": float(item_lng),
                        "distance": distance,
                    }

        if not nearest:
            return {
                "road": "Unknown road",
                "crossroad": "",
                "lat": lat,
                "lng": lng,
            }

        if nearest["distance"] > 0.0015:
            return {
                "road": nearest["road"],
                "crossroad": "",
                "lat": lat,
                "lng": lng,
            }

        return nearest

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to find nearest location: {str(e)}"
        )
