from app.services.risk_analysis import (
    bounding_box,
    haversine_m,
    level_for_score,
    normalize_type,
    normalize_weather,
)


def test_haversine_returns_zero_for_same_point():
    assert haversine_m(51.1694, 71.4491, 51.1694, 71.4491) == 0


def test_bounding_box_contains_origin_point():
    lat = 51.1694
    lng = 71.4491
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, 450)

    assert min_lat < lat < max_lat
    assert min_lng < lng < max_lng


def test_level_for_score_thresholds():
    assert level_for_score(10) == "LOW"
    assert level_for_score(40) == "MEDIUM"
    assert level_for_score(70) == "HIGH"


def test_normalizers_collapse_common_inputs():
    assert normalize_weather("Snow and ice") == "snow"
    assert normalize_type("Pedestrian collision") == "pedestrian"
