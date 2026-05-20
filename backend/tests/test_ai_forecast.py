from app.services.ai_forecast import fallback_forecast, get_risk_level


def make_summary(**overrides):
    summary = {
        "risk_level": "LOW",
        "busiest_district": "Citywide",
        "safest_district": "Citywide",
        "most_common_weather": "Unknown",
        "most_common_type": "Unknown",
        "peak_hour": "0",
        "top_districts": [],
        "active_jams": 0,
        "total_reports": 0,
        "road_focus": None,
    }
    summary.update(overrides)
    return summary


def test_get_risk_level_uses_report_pressure():
    assert get_risk_level(high_ratio=0, total_reports=0, active_jams=0) == "LOW"
    assert get_risk_level(high_ratio=0.25, total_reports=8, active_jams=1) == "MEDIUM"
    assert get_risk_level(high_ratio=0.1, total_reports=8, active_jams=4) == "HIGH"


def test_fallback_forecast_returns_complete_shape_without_data():
    forecast = fallback_forecast(make_summary(), lang="en")

    assert forecast["risk_level"] == "LOW"
    assert forecast["danger_zones"] == []
    assert set(["morning", "afternoon", "evening", "night"]).issubset(forecast)


def test_fallback_forecast_builds_danger_zones_from_summary():
    forecast = fallback_forecast(
        make_summary(
            risk_level="MEDIUM",
            total_reports=5,
            top_districts=[{"name": "Esil", "count": 3}],
        ),
        lang="en",
    )

    assert forecast["danger_zones"][0]["name"] == "Esil"
    assert forecast["danger_zones"][0]["tag"] == "MEDIUM"
