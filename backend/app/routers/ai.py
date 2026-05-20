from typing import Optional
import json
import logging
import random

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.ai_forecast import ask_gemini_json, build_summary, fallback_forecast

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)

@router.get("/traffic-summary")
def get_traffic_summary(
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return build_summary(db, date)


@router.get("/dashboard-insight")
def get_dashboard_insight(
    date: Optional[str] = Query(None),
    refresh_seed: Optional[int] = Query(None),
    lang: str = Query("ru"),
    db: Session = Depends(get_db)
):
    summary = build_summary(db, date)

    if refresh_seed is None:
        refresh_seed = random.randint(1000, 999999)

    prompt = f"""
You are a traffic safety analyst for Astana.

Use ONLY the JSON data below.
Return valid JSON with exactly these fields:
- insight

Rules:
- 3 to 5 sentences
- do not invent roads or facts
- mention risk level
- mention busiest district
- vary wording naturally using this refresh seed: {refresh_seed}

DATA:
{json.dumps(summary, ensure_ascii=False)}
""".strip()

    try:
        text = ask_gemini_json(prompt, lang)
        if text:
            parsed = json.loads(text)
            return {
                "insight": parsed.get("insight", ""),
                "summary": summary,
                "source": "gemini",
                "refresh_seed": refresh_seed,
            }
    except Exception as e:
        logger.warning("Gemini dashboard insight error: %s", e)

    return {
        "insight": fallback_forecast(summary, lang)["insight"],
        "summary": summary,
        "source": "fallback",
        "refresh_seed": refresh_seed,
    }


@router.get("/forecast")
def get_forecast(
    date: Optional[str] = Query(None),
    refresh_seed: Optional[int] = Query(None),
    style_hint: Optional[str] = Query(None),
    lang: str = Query("ru"),
    db: Session = Depends(get_db)
):
    summary = build_summary(db, date)

    if refresh_seed is None:
        refresh_seed = random.randint(1000, 999999)

    if not style_hint:
        style_hint = "concise"

    prompt = f"""
You are a traffic safety analyst for Astana.

Use ONLY the JSON data below.
Return valid JSON with exactly these fields:
- summary_title
- summary_subtitle
- morning: object with risk and text
- afternoon: object with risk and text
- evening: object with risk and text
- night: object with risk and text
- danger_zones: array of 2 or 3 objects, each with name, desc, and tag
- risk_level
- reasoning
- recommendation
- insight

Rules:
- risk_level must be one of: HIGH, MEDIUM, LOW
- each period risk must be one of: HIGH, MEDIUM, LOW
- do not invent roads that are not in the data
- prefer districts as danger zones
- never use the word Unknown as a location; use Citywide if district data is missing
- wording style for this response must follow this style hint: {style_hint}
- use clearly different sentence structure from a previous response
- vary openings, tone, and phrasing naturally
- use this refresh seed for variation: {refresh_seed}
- keep it realistic and professional

DATA:
{json.dumps(summary, ensure_ascii=False)}
""".strip()

    try:
        text = ask_gemini_json(prompt, lang)
        if text:
            parsed = json.loads(text)
            parsed["summary_data"] = summary
            parsed["source"] = "gemini"
            parsed["refresh_seed"] = refresh_seed
            parsed["style_hint"] = style_hint
            return parsed
    except Exception as e:
        logger.warning("Gemini forecast error: %s", e)

    fallback = fallback_forecast(summary, lang)
    fallback["summary_data"] = summary
    fallback["source"] = "fallback"
    fallback["refresh_seed"] = refresh_seed
    fallback["style_hint"] = style_hint
    return fallback
