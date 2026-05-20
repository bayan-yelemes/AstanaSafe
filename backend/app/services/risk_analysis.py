from __future__ import annotations

from collections import Counter
from datetime import datetime
from functools import lru_cache
import json
import math
import os
from typing import Iterable

from sqlalchemy.orm import Session

from ..models.models import RealAccident, TrafficReport

EARTH_RADIUS_M = 6_371_000
DEFAULT_RADIUS_M = 450
MIN_RADIUS_M = 150
MAX_RADIUS_M = 900
ASTANA_LAT = 51.1694
ASTANA_LNG = 71.4491

DISTRICT_MAP = {
    "\u0421\u0430\u0440\u044b\u0430\u0440\u043a\u0430": "Saryarka",
    "\u0411\u0430\u0439\u043a\u043e\u043d\u0443\u0440": "Baikonur",
    "\u0411\u0430\u0439\u049b\u043e\u04a3\u044b\u0440": "Baikonur",
    "\u041d\u0443\u0440\u0430": "Nura",
    "\u0410\u043b\u043c\u0430\u0442\u044b": "Almaty",
    "\u0421\u0430\u0440\u0430\u0439\u0448\u044b\u043a": "Saraishyk",
    "\u0415\u0441\u0438\u043b\u044c": "Esil",
    "\u0415\u0441\u0456\u043b": "Esil",
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bounding_box(lat: float, lng: float, radius_m: float):
    lat_delta = radius_m / 111_320
    lng_delta = radius_m / (111_320 * max(math.cos(math.radians(lat)), 0.01))
    return lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta


def destination_point(lat: float, lng: float, bearing_deg: float, distance_m: float):
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lng1 = math.radians(lng)
    angular = distance_m / EARTH_RADIUS_M

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular)
        + math.cos(lat1) * math.sin(angular) * math.cos(bearing)
    )
    lng2 = lng1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return {"lat": math.degrees(lat2), "lng": math.degrees(lng2)}


def make_hex_zone(lat: float, lng: float, radius_m: float):
    cell_x = round((lng - ASTANA_LNG) * 111_320 * math.cos(math.radians(ASTANA_LAT)) / 400)
    cell_y = round((lat - ASTANA_LAT) * 111_320 / 400)

    polygon = [
        destination_point(lat, lng, 30 + i * 60, radius_m)
        for i in range(6)
    ]
    polygon.append(polygon[0])

    return {
        "id": f"AST-HX-{cell_x:+d}-{cell_y:+d}",
        "center": {"lat": lat, "lng": lng},
        "radius_m": round(radius_m),
        "polygon": polygon,
    }


def parse_datetime(value) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.replace(tzinfo=None)

    text = str(value).strip()
    if not text:
        return None

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def severity_weight(value: str | None) -> float:
    text = str(value or "").lower()
    if "high" in text or "fatal" in text:
        return 3.0
    if "medium" in text or "injury" in text:
        return 2.0
    return 1.0


def traffic_weight(category: str | None) -> float:
    text = str(category or "").lower()
    if "high" in text:
        return 3.0
    if "medium" in text:
        return 2.0
    if "traffic" in text or "jam" in text:
        return 1.6
    return 1.0


def normalize_weather(value: str | None) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return "unknown"
    if "snow" in text:
        return "snow"
    if "ice" in text:
        return "ice"
    if "rain" in text:
        return "rain"
    if "storm" in text:
        return "storm"
    if "clear" in text or "dry" in text:
        return "clear"
    return text


def normalize_type(value: str | None) -> str:
    text = str(value or "").strip().lower()
    if not text or text == "none":
        return "unknown"
    if "pedestrian" in text:
        return "pedestrian"
    if "rollover" in text:
        return "rollover"
    if "collision" in text:
        return "collision"
    return text


def most_common(counter: Counter, default="unknown"):
    if not counter:
        return {"name": default, "count": 0}
    name, count = counter.most_common(1)[0]
    return {"name": name, "count": count}


def point_in_ring(lng: float, lat: float, ring: list) -> bool:
    if not isinstance(ring, list) or len(ring) < 3:
        return False

    inside = False
    j = len(ring) - 1

    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]

        if ((yi > lat) != (yj > lat)) and (
            lng < ((xj - xi) * (lat - yi)) / ((yj - yi) or 1e-12) + xi
        ):
            inside = not inside
        j = i

    return inside


def point_in_geometry(lat: float, lng: float, geometry: dict) -> bool:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")

    if geometry_type == "Polygon":
        return bool(coordinates and point_in_ring(lng, lat, coordinates[0]))

    if geometry_type == "MultiPolygon":
        return any(point_in_ring(lng, lat, polygon[0]) for polygon in coordinates or [])

    return False


def district_label(properties: dict) -> str:
    for key in ("name_object", "name_object_kaz", "region", "name"):
        value = properties.get(key)
        if value in DISTRICT_MAP:
            return DISTRICT_MAP[value]
    return "Unknown"


@lru_cache(maxsize=1)
def load_districts():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    file_path = os.path.join(base_dir, "astana_districts.geojson")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_intersections():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    file_path = os.path.join(base_dir, "astana_intersections.json")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def find_district(lat: float, lng: float) -> str:
    try:
        for feature in load_districts().get("features", []):
            if point_in_geometry(lat, lng, feature.get("geometry") or {}):
                label = district_label(feature.get("properties") or {})
                if label != "Unknown":
                    return label
    except Exception:
        return "Unknown"

    return "Unknown"


def find_nearest_intersection(lat: float, lng: float, max_distance_m: float = 1_200):
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, max_distance_m)
    nearest = None
    nearest_distance = float("inf")

    for road, items in load_intersections().items():
        for item in items:
            item_lat = item.get("lat")
            item_lng = item.get("lng")
            if item_lat is None or item_lng is None:
                continue

            item_lat = float(item_lat)
            item_lng = float(item_lng)
            if not (min_lat <= item_lat <= max_lat and min_lng <= item_lng <= max_lng):
                continue

            distance = haversine_m(lat, lng, item_lat, item_lng)
            if distance < nearest_distance:
                nearest_distance = distance
                nearest = {
                    "road": road,
                    "crossroad": str(item.get("crossroad") or "").strip(),
                    "lat": item_lat,
                    "lng": item_lng,
                    "distance_m": round(distance),
                }

    return nearest


def query_local_real_accidents(db: Session, lat: float, lng: float, radius_m: float):
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_m)
    candidates = (
        db.query(RealAccident)
        .filter(RealAccident.latitude.between(min_lat, max_lat))
        .filter(RealAccident.longitude.between(min_lng, max_lng))
        .all()
    )

    return [
        item
        for item in candidates
        if haversine_m(lat, lng, item.latitude, item.longitude) <= radius_m
    ]


def query_local_traffic_reports(
    db: Session,
    lat: float,
    lng: float,
    radius_m: float,
    date: str | None = None,
):
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_m)
    query = (
        db.query(TrafficReport)
        .filter(TrafficReport.lat.between(min_lat, max_lat))
        .filter(TrafficReport.lng.between(min_lng, max_lng))
    )

    reports = query.all()
    if date:
        reports = [
            item
            for item in reports
            if item.created_at and item.created_at.date().isoformat() == date
        ]

    return [
        item
        for item in reports
        if haversine_m(lat, lng, item.lat, item.lng) <= radius_m
    ]


def hour_bucket(items: Iterable[datetime | None]) -> Counter:
    counter = Counter()
    for item in items:
        if item:
            counter[f"{item.hour:02d}:00"] += 1
    return counter


def level_for_score(score: int) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def build_risk_score(
    accidents: list[RealAccident],
    reports: list[TrafficReport],
    nearest_intersection: dict | None,
):
    accident_weight = sum(severity_weight(item.severity) for item in accidents)
    traffic_pressure = sum(traffic_weight(item.category) for item in reports)

    weather_values = [
        normalize_weather(item.weather or item.road_condition)
        for item in accidents
    ] + [normalize_weather(item.weather) for item in reports]
    bad_weather_count = sum(
        1 for item in weather_values if item in {"rain", "snow", "ice", "storm"}
    )
    weather_factor = bad_weather_count / max(len(weather_values), 1)

    accident_dates = [parse_datetime(item.accident_date_raw) for item in accidents]
    report_dates = [parse_datetime(item.created_at) for item in reports]
    hours = hour_bucket([*accident_dates, *report_dates])
    peak_share = max(hours.values(), default=0) / max(sum(hours.values()), 1)

    recent_years = sum(1 for item in accidents if item.year and item.year >= 2024)
    recent_factor = recent_years / max(len(accidents), 1)

    if nearest_intersection:
        distance = nearest_intersection["distance_m"]
        if distance <= 120:
            intersection_factor = 1.0
        elif distance <= 300:
            intersection_factor = 0.65
        else:
            intersection_factor = 0.35
    else:
        intersection_factor = 0

    density_factor = clamp(math.log1p(accident_weight) / math.log1p(34), 0, 1)
    traffic_factor = clamp(math.log1p(traffic_pressure) / math.log1p(12), 0, 1)

    score = round(
        100
        * (
            0.46 * density_factor
            + 0.20 * traffic_factor
            + 0.12 * intersection_factor
            + 0.10 * weather_factor
            + 0.07 * peak_share
            + 0.05 * recent_factor
        )
    )

    return clamp(score, 0, 100), {
        "density_factor": round(density_factor, 3),
        "traffic_factor": round(traffic_factor, 3),
        "intersection_factor": round(intersection_factor, 3),
        "weather_factor": round(weather_factor, 3),
        "time_factor": round(peak_share, 3),
        "recent_factor": round(recent_factor, 3),
    }


def build_reasons(
    score: int,
    accidents: list[RealAccident],
    reports: list[TrafficReport],
    nearest_intersection: dict | None,
    top_weather: dict,
    peak_hour: dict,
):
    reasons = []

    if accidents:
        reasons.append(f"{len(accidents)} historical accidents were found inside the selected zone.")
    else:
        reasons.append("No historical accident cluster was found inside the selected zone.")

    active_jams = sum(
        1 for item in reports if "traffic" in str(item.category or "").lower()
    )
    if active_jams:
        reasons.append(f"{active_jams} active traffic jam reports are close to this point.")
    elif reports:
        reasons.append(f"{len(reports)} user incident reports are close to this point.")

    if nearest_intersection and nearest_intersection["distance_m"] <= 180:
        reasons.append(
            f"The point is near an intersection, about {nearest_intersection['distance_m']} m away."
        )

    if top_weather["name"] in {"rain", "snow", "ice", "storm"}:
        reasons.append(f"Bad weather is a repeated factor here: {top_weather['name']}.")

    if peak_hour["count"] >= 2:
        reasons.append(f"Incidents concentrate around {peak_hour['name']}.")

    if score >= 70:
        reasons.append("The combined accident density and road pressure are above the city baseline.")
    elif score >= 40:
        reasons.append("The area has moderate safety pressure and should be monitored.")
    else:
        reasons.append("The current pattern is below the high-risk threshold.")

    return reasons[:5]


def build_interventions(score: int, nearest_intersection: dict | None, top_weather: str, reports: list[TrafficReport]):
    near_intersection = bool(nearest_intersection and nearest_intersection["distance_m"] <= 250)
    traffic_pressure = any("traffic" in str(item.category or "").lower() for item in reports)
    weather_sensitive = top_weather in {"rain", "snow", "ice", "storm"}

    scenarios = [
        {
            "name": "Speed calming",
            "effect": 16 if score >= 70 else 10,
            "detail": "Lower speed pressure with signs, lane narrowing, or speed control.",
        },
        {
            "name": "Signal timing review",
            "effect": 18 if near_intersection else 8,
            "detail": "Reduce turning and crossing conflicts at nearby intersections.",
        },
        {
            "name": "Lighting and visibility",
            "effect": 14 if weather_sensitive else 7,
            "detail": "Improve night visibility and warning distance in poor weather.",
        },
        {
            "name": "Congestion warning",
            "effect": 13 if traffic_pressure else 6,
            "detail": "Warn drivers before dense traffic or repeated jam points.",
        },
    ]

    return [
        {
            **item,
            "projected_score": max(0, score - item["effect"]),
            "risk_delta": -item["effect"],
        }
        for item in scenarios
    ]


def build_explanation(level: str, score: int, district: str, accidents_count: int, reports_count: int, peak_hour: str):
    place = district if district != "Unknown" else "this part of Astana"
    return (
        f"This zone is classified as {level.lower()} risk with a score of {score}/100. "
        f"The model found {accidents_count} historical accidents and {reports_count} user reports near {place}. "
        f"The most visible pressure point is around {peak_hour}, so the dashboard treats this area as a local safety zone rather than a single map point."
    )

def analyze_zone(
    db: Session,
    lat: float,
    lng: float,
    radius_m: int = DEFAULT_RADIUS_M,
    date: str | None = None,
):
    radius = int(clamp(radius_m, MIN_RADIUS_M, MAX_RADIUS_M))
    accidents = query_local_real_accidents(db, lat, lng, radius)
    reports = query_local_traffic_reports(db, lat, lng, radius, date)
    nearest = find_nearest_intersection(lat, lng)
    district = find_district(lat, lng)
    score, factors = build_risk_score(accidents, reports, nearest)
    score = int(score)
    level = level_for_score(score)

    weather_counter = Counter(
        normalize_weather(item.weather or item.road_condition) for item in accidents
    )
    weather_counter.update(normalize_weather(item.weather) for item in reports)

    type_counter = Counter(normalize_type(item.accident_type) for item in accidents)
    type_counter.update(normalize_type(item.type) for item in reports)

    hours = hour_bucket(
        [parse_datetime(item.accident_date_raw) for item in accidents]
        + [parse_datetime(item.created_at) for item in reports]
    )

    top_weather = most_common(weather_counter)
    top_type = most_common(type_counter)
    peak_hour = most_common(hours, default="--:--")

    interventions = build_interventions(score, nearest, top_weather["name"], reports)
    reasons = build_reasons(score, accidents, reports, nearest, top_weather, peak_hour)

    return {
        "model": {
            "name": "AstanaSafe Spatial Risk Model",
            "version": "1.0",
            "method": "data-driven spatial scoring",
        },
        "query": {
            "lat": lat,
            "lng": lng,
            "date": date,
        },
        "zone": make_hex_zone(lat, lng, radius),
        "risk": {
            "score": score,
            "level": level,
            "factors": factors,
        },
        "location": {
            "district": district,
            "nearest_intersection": nearest,
        },
        "statistics": {
            "historical_accidents": len(accidents),
            "traffic_reports": len(reports),
            "active_jams": sum(
                1 for item in reports if "traffic" in str(item.category or "").lower()
            ),
            "top_weather": top_weather,
            "top_type": top_type,
            "peak_hour": peak_hour,
            "years": dict(Counter(str(item.year) for item in accidents if item.year)),
        },
        "reasons": reasons,
        "interventions": interventions,
        "explanation": build_explanation(
            level,
            score,
            district,
            len(accidents),
            len(reports),
            peak_hour["name"],
        ),
    }
