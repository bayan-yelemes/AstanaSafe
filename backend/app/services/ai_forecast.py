from typing import Optional
import logging
import warnings

from sqlalchemy import Date, cast
from sqlalchemy.orm import Session

try:
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=FutureWarning)
        import google.generativeai as genai
except ImportError:  # pragma: no cover - fallback mode should still run locally
    genai = None

from ..config import GEMINI_API_KEY, GEMINI_MODEL
from ..models import models

logger = logging.getLogger(__name__)

def get_risk_level(high_ratio: float, total_reports: int, active_jams: int) -> str:
    if total_reports == 0:
        return "LOW"
    if high_ratio >= 0.4 or active_jams >= 4:
        return "HIGH"
    if high_ratio >= 0.2 or active_jams >= 2:
        return "MEDIUM"
    return "LOW"


def build_summary(db: Session, date: Optional[str] = None):
    accident_query = db.query(models.Accident)
    traffic_query = db.query(models.TrafficReport)

    if date:
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date, "%Y-%m-%d").date()
        except Exception:
            date_obj = None

        if date_obj:
            accident_query = accident_query.filter(cast(models.Accident.date, Date) == date_obj)
            traffic_query = traffic_query.filter(
                cast(models.TrafficReport.created_at, Date) == date_obj
            )

    accidents = accident_query.all()
    traffic_reports = traffic_query.all()

    district_counts = {
        "Almaty": 0,
        "Baikonur": 0,
        "Esil": 0,
        "Nura": 0,
        "Saryarka": 0,
        "Saraishyk": 0,
        "Unknown": 0,
    }

    # road counts inside each district
    district_road_counts = {
        "Almaty": {},
        "Baikonur": {},
        "Esil": {},
        "Nura": {},
        "Saryarka": {},
        "Saraishyk": {},
        "Unknown": {},
    }

    type_counts = {}
    weather_counts = {}
    severity_counts = {
        "high": 0,
        "medium": 0,
        "low": 0,
        "unknown": 0,
    }
    hour_counts = {str(h): 0 for h in range(24)}

    traffic_category_counts = {}
    active_jams = 0

    # accidents
    for accident in accidents:
        district_name = "Unknown"
        if accident.district and accident.district.name:
            district_name = accident.district.name

        district_counts[district_name] = district_counts.get(district_name, 0) + 1

        accident_type = accident.type or "Unknown"
        type_counts[accident_type] = type_counts.get(accident_type, 0) + 1

        weather = accident.weather or "Unknown"
        weather_counts[weather] = weather_counts.get(weather, 0) + 1

        severity = (accident.severity or "").lower()
        if severity in severity_counts:
            severity_counts[severity] += 1
        else:
            severity_counts["unknown"] += 1

        if accident.date:
            hour_key = str(accident.date.hour)
            hour_counts[hour_key] = hour_counts.get(hour_key, 0) + 1

    # traffic reports
    for report in traffic_reports:
        district_name = (report.district or "").strip() or "Unknown"
        road_name = (report.road or "").strip()

        district_counts[district_name] = district_counts.get(district_name, 0) + 1

        if district_name not in district_road_counts:
            district_road_counts[district_name] = {}

        if road_name:
            district_road_counts[district_name][road_name] = (
                district_road_counts[district_name].get(road_name, 0) + 1
            )

        category = report.category or "Unknown"
        traffic_category_counts[category] = (
            traffic_category_counts.get(category, 0) + 1
        )

        report_type = report.type or "Unknown"
        type_counts[report_type] = type_counts.get(report_type, 0) + 1

        weather = report.weather or "Unknown"
        weather_counts[weather] = weather_counts.get(weather, 0) + 1

        if category == "Active Traffic Jam":
            active_jams += 1

        if report.created_at:
            hour_key = str(report.created_at.hour)
            hour_counts[hour_key] = hour_counts.get(hour_key, 0) + 1

    known_districts = {
        k: v for k, v in district_counts.items() if k != "Unknown" and v > 0
    }

    busiest_district = (
        max(known_districts, key=known_districts.get)
        if known_districts
        else "Citywide"
    )

    safest_district = (
        min(known_districts, key=known_districts.get)
        if known_districts
        else "Citywide"
    )

    busiest_district_roads = district_road_counts.get(busiest_district, {})
    busiest_road = None
    busiest_road_count = 0

    if busiest_district_roads:
        busiest_road = max(busiest_district_roads, key=busiest_district_roads.get)
        busiest_road_count = busiest_district_roads[busiest_road]

    most_common_type = max(type_counts, key=type_counts.get) if type_counts else "Unknown"
    most_common_weather = (
        max(weather_counts, key=weather_counts.get) if weather_counts else "Unknown"
    )
    peak_hour = max(hour_counts, key=hour_counts.get) if hour_counts else "0"

    total_accidents = len(accidents)
    total_traffic_reports = len(traffic_reports)
    total_reports = total_accidents + total_traffic_reports

    high_severity_count = severity_counts["high"]
    high_severity_ratio = (
        round((high_severity_count / total_accidents), 3) if total_accidents > 0 else 0
    )
    risk_level = get_risk_level(high_severity_ratio, total_reports, active_jams)

    top_districts = sorted(
        [{"name": k, "count": v} for k, v in known_districts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:3]

    top_types = sorted(
        [{"name": k, "count": v} for k, v in type_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:3]

    top_categories = sorted(
        [{"name": k, "count": v} for k, v in traffic_category_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:3]

    # show road only if it is repeated enough inside the busiest district
    road_focus = None
    if busiest_road and busiest_road_count >= 2:
        road_focus = {
            "district": busiest_district,
            "road": busiest_road,
            "count": busiest_road_count,
        }

    return {
        "date": date,
        "total_accidents": total_accidents,
        "total_traffic_reports": total_traffic_reports,
        "total_reports": total_reports,
        "active_jams": active_jams,
        "high_severity_count": high_severity_count,
        "high_severity_ratio": high_severity_ratio,
        "risk_level": risk_level,
        "severity_counts": severity_counts,
        "district_counts": district_counts,
        "district_road_counts": district_road_counts,
        "type_counts": type_counts,
        "weather_counts": weather_counts,
        "traffic_category_counts": traffic_category_counts,
        "busiest_district": busiest_district,
        "safest_district": safest_district,
        "road_focus": road_focus,
        "most_common_type": most_common_type,
        "most_common_weather": most_common_weather,
        "peak_hour": peak_hour,
        "top_districts": top_districts,
        "top_types": top_types,
        "top_categories": top_categories,
        "note": "Summary includes both accident records and backend traffic reports.",
    }


def fallback_forecast(summary: dict, lang: str = "ru"):
    lang = (lang or "ru").lower()
    risk_level = summary["risk_level"]
    busiest = summary["busiest_district"]
    safest = summary["safest_district"]
    peak_hour = summary["peak_hour"]
    top_districts = summary["top_districts"]
    total_reports = summary["total_reports"]
    road_focus = summary.get("road_focus")
    danger_zones = [
        {
            "name": item["name"],
            "desc": f"{item['count']} reports",
            "tag": risk_level,
        }
        for item in top_districts[:3]
    ]
    
    # Localized messages
    msgs = {
        "kz": {
            "title": "AI қауіпсіздік талдауы",
            "subtitle": "Нақты уақыттағы деректер негізіндегі болжам.",
            "no_data_text": "Деректер жеткіліксіз.",
            "waiting_data": "Болжам нақты деректердің жиналуын күтуде.",
            "recommend_collect": "Дәлірек болжам жасау үшін деректерді жинауды жалғастырыңыз.",
            "risk_reason": "Талдау үшін ЖКО немесе кептелістер туралы деректер жеткіліксіз.",
            "busiest_note": "Ең белсенді аудан — {busiest}, ал {safest} қазір тыныш көрінеді.",
            "insight_main": "Астанадағы жағдай қауіпсіздікке негізгі қысым {busiest} ауданында екенін көрсетеді.",
            "rec_main": "{place} аумағында жылдамдықты азайтып, қауіпсіз қашықтықты сақтаңыз.",
            "morning": "Таңертең {risk} тәуекел күтіледі.",
            "afternoon": "Күндіз {busiest} ауданында жүктеме артуы мүмкін.",
            "evening": "Кешкі уақыт ең қиын кезең болып қала береді.",
            "night": "Түнгі сапарлар көру мүмкіндігі төмендегенде қауіпті болып қалады."
        },
        "ru": {
            "title": "ИИ Анализ Безопасности",
            "subtitle": "Прогноз на основе данных в реальном времени.",
            "no_data_text": "Данные отсутствуют.",
            "waiting_data": "Прогноз ожидает накопления реальных данных.",
            "recommend_collect": "Продолжайте собирать данные для более точного прогнозирования.",
            "risk_reason": "Недостаточно данных о ДТП или пробках для анализа.",
            "busiest_note": "Самый активный район — {busiest}, в то время как {safest} сейчас выглядит спокойнее.",
            "insight_main": "Текущая ситуация в Астане указывает на то, что основное давление на безопасность сосредоточено в районе {busiest}.",
            "rec_main": "Соблюдайте дистанцию и будьте осторожны в районе {place}.",
            "morning": "Утром ожидается {risk} риск.",
            "afternoon": "Днем нагрузка может вырасти в районе {busiest}.",
            "evening": "Вечер остается самым сложным периодом.",
            "night": "Ночные поездки остаются рискованными при сниженной видимости."
        },
        "en": {
            "title": "AI Safety Intelligence",
            "subtitle": "Real-time predictive analysis for Astana.",
            "no_data_text": "No data available.",
            "waiting_data": "Forecast is waiting for more real data.",
            "recommend_collect": "Continue collecting traffic and accident data for more accurate forecasting.",
            "risk_reason": "Not enough accident or traffic report data is available yet.",
            "busiest_note": "The busiest district is {busiest}, while {safest} currently appears safer.",
            "insight_main": "Astana's current traffic pattern suggests the greatest safety pressure is concentrated in {busiest} district.",
            "rec_main": "Reduce speed, increase following distance, and be careful in {place}.",
            "morning": "Morning conditions are expected to remain {risk} risk.",
            "afternoon": "Afternoon pressure may build near {busiest} district.",
            "evening": "Evening remains the most sensitive period.",
            "night": "Night travel remains riskier when visibility is reduced."
        }
    }
    
    L = msgs.get(lang, msgs["ru"])

    if total_reports == 0:
        return {
            "summary_title": L["title"],
            "summary_subtitle": L["subtitle"],
            "morning": {"risk": "LOW", "text": L["no_data_text"]},
            "afternoon": {"risk": "LOW", "text": L["no_data_text"]},
            "evening": {"risk": "LOW", "text": L["no_data_text"]},
            "night": {"risk": "LOW", "text": L["no_data_text"]},
            "danger_zones": [],
            "risk_level": "LOW",
            "reasoning": L["risk_reason"],
            "recommendation": L["recommend_collect"],
            "insight": L["waiting_data"],
        }

    if risk_level == "LOW":
        morning_risk = "LOW"
        afternoon_risk = "LOW"
        evening_risk = "MEDIUM"
        night_risk = "MEDIUM"
    elif risk_level == "MEDIUM":
        morning_risk = "LOW"
        afternoon_risk = "MEDIUM"
        evening_risk = "HIGH"
        night_risk = "HIGH"
    else:
        morning_risk = "MEDIUM"
        afternoon_risk = "MEDIUM"
        evening_risk = "HIGH"
        night_risk = "HIGH"

    if road_focus:
        road_note_map = {
            "kz": f" {road_focus['road']} жолындағы қайталанған есептермен",
            "ru": f" с повторными отчетами на {road_focus['road']}",
            "en": f" with repeated reports on {road_focus['road']}"
        }
        road_note = road_note_map.get(lang, road_note_map["ru"])
        recommendation_place = f"{busiest}, {road_focus['road']}"
    else:
        road_note = ""
        recommendation_place = busiest

    return {
        "summary_title": L["title"],
        "summary_subtitle": L["subtitle"],
        "morning": {
            "risk": morning_risk,
            "text": L["morning"].format(risk=morning_risk.lower(), busiest=busiest)
        },
        "afternoon": {
            "risk": afternoon_risk,
            "text": L["afternoon"].format(busiest=busiest)
        },
        "evening": {
            "risk": evening_risk,
            "text": f"{L['evening']} ({peak_hour}:00)."
        },
        "night": {
            "risk": night_risk,
            "text": L["night"]
        },
        "danger_zones": danger_zones,
        "risk_level": risk_level,
        "reasoning": L["risk_reason"] if total_reports < 3 else L["busiest_note"].format(busiest=busiest, safest=safest),
        "recommendation": L["rec_main"].format(place=recommendation_place),
        "insight": L["insight_main"].format(busiest=busiest) + road_note,
    }


def ask_gemini_json(prompt: str, lang: str = "ru"):
    if not GEMINI_API_KEY or genai is None:
        return None
    
    lang = (lang or "ru").lower()
    lang_names = {"kz": "Kazakh", "ru": "Russian", "en": "English"}
    target_lang = lang_names.get(lang, "Russian")

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        # Adding JSON instruction and target language requirement
        full_prompt = (
            f"{prompt}\n\n"
            f"IMPORTANT: Response MUST be in {target_lang} language. "
            "Translate every human-readable JSON value, including explanations, "
            "recommendations, titles, and zone descriptions. Return only raw JSON."
        )
        
        response = model.generate_content(
            full_prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return response.text
    except Exception as e:
        logger.info("Gemini generation unavailable, using fallback forecast: %s", e)
        return None
