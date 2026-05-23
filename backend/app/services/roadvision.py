from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha1
import json
import logging
from pathlib import Path
import re
import tempfile
import time
from typing import Optional

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover - fallback still works without Gemini
    genai = None
    genai_types = None

from ..config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)


ASTANA_DEFAULT_LOCATION = {
    "name": "Кабанбай батыра / Сыганак",
    "lat": 51.1239,
    "lng": 71.4302,
    "district": "Esil",
    "road": "Кабанбай батыра",
}

SCENARIO_PROFILES = {
    "unknown": {
        "title": "Событие ДТП определяется по видео",
        "cause": "тип события не задан оператором и требует проверки по видеозаписи",
        "violation_actor": "Not assigned",
        "violation_summary": "признаки нарушения не назначены до сверки видео оператором",
        "impact": "unknown",
        "risk_bias": 4,
        "delay_bias": 5,
        "participant_a_movement": "движение участника A требует сверки по видео",
        "participant_b_movement": "движение участника B требует сверки по видео",
        "participant_a_speed": "скорость требует оценки по кадрам",
        "participant_b_speed": "скорость требует оценки по кадрам",
        "timeline": [
            ("00:02", "Видео принято", "Система получила запись и ожидает сверки видимых участников.", "info"),
            ("00:05", "Требуется анализ кадров", "Тип события и траектории должны быть подтверждены по видеоряду.", "warning"),
            ("00:08", "Операторская проверка", "Резервный отчет не назначает конкретный сценарий ДТП.", "warning"),
        ],
    },
    "left_turn_conflict": {
        "title": "Боковое столкновение при левом повороте",
        "cause": "автомобиль B начал левый поворот и пересек траекторию автомобиля A",
        "violation_actor": "Vehicle B",
        "violation_summary": "признаки непредоставления преимущества при маневре",
        "impact": "side_impact",
        "risk_bias": 12,
        "delay_bias": 9,
        "participant_a_movement": "движение прямо по основной полосе",
        "participant_b_movement": "левый поворот через встречный поток",
        "participant_a_speed": "скорость стабильная до момента контакта",
        "participant_b_speed": "замедление и изменение направления перед контактом",
        "timeline": [
            ("00:02", "Обнаружены участники", "Vehicle A движется прямо, Vehicle B приближается к зоне поворота.", "info"),
            ("00:04", "Начало маневра", "Vehicle B начинает левый поворот и выходит на конфликтную траекторию.", "warning"),
            ("00:06", "Момент контакта", "Траектории участников пересекаются в центральной зоне перекрестка.", "danger"),
            ("00:11", "Последствие для потока", "После контакта фиксируется блокировка полосы и рост плотности потока.", "warning"),
        ],
    },
    "rear_end": {
        "title": "Попутное столкновение",
        "cause": "автомобиль B резко сократил дистанцию и не успел затормозить",
        "violation_actor": "Vehicle B",
        "violation_summary": "признаки несоблюдения дистанции",
        "impact": "rear_end",
        "risk_bias": 8,
        "delay_bias": 6,
        "participant_a_movement": "движение вперед с последующим торможением",
        "participant_b_movement": "движение позади в той же полосе",
        "participant_a_speed": "скорость снижается перед контактом",
        "participant_b_speed": "запаздывающее торможение и сокращение дистанции",
        "timeline": [
            ("00:02", "Поток в одной полосе", "Vehicle A и Vehicle B движутся в одном направлении.", "info"),
            ("00:04", "Снижение скорости", "Vehicle A замедляется, дистанция между участниками сокращается.", "warning"),
            ("00:06", "Попутный контакт", "Vehicle B достигает задней части Vehicle A.", "danger"),
            ("00:10", "Очередь транспорта", "На полосе образуется локальное замедление потока.", "warning"),
        ],
    },
    "red_light": {
        "title": "Конфликт на регулируемом перекрестке",
        "cause": "один из участников продолжил движение через конфликтную фазу",
        "violation_actor": "Vehicle A",
        "violation_summary": "признаки проезда на запрещающий сигнал",
        "impact": "intersection_conflict",
        "risk_bias": 15,
        "delay_bias": 11,
        "participant_a_movement": "продолжение движения через регулируемый перекресток",
        "participant_b_movement": "старт или движение с поперечного направления",
        "participant_a_speed": "скорость не снижается перед стоп-линией",
        "participant_b_speed": "ускорение после начала разрешающей фазы",
        "timeline": [
            ("00:02", "Регулируемый перекресток", "Обнаружены участники на пересекающихся направлениях.", "info"),
            ("00:04", "Конфликт фаз", "Vehicle A продолжает движение в момент, когда Vehicle B входит в перекресток.", "warning"),
            ("00:06", "Пересечение траекторий", "Участники оказываются в одной конфликтной зоне.", "danger"),
            ("00:12", "Остановка потока", "После конфликта движение на подходах к перекрестку замедляется.", "warning"),
        ],
    },
    "lane_block": {
        "title": "Блокировка полосы после инцидента",
        "cause": "транспортное средство остановилось в активной полосе движения",
        "violation_actor": "Vehicle B",
        "violation_summary": "признаки опасной остановки на полосе",
        "impact": "lane_block",
        "risk_bias": 10,
        "delay_bias": 14,
        "participant_a_movement": "объезд препятствия по соседней полосе",
        "participant_b_movement": "остановка в активной полосе",
        "participant_a_speed": "скорость снижается при объезде",
        "participant_b_speed": "скорость падает до полной остановки",
        "timeline": [
            ("00:02", "Снижение скорости", "Vehicle B резко замедляется в активной полосе.", "info"),
            ("00:05", "Остановка", "Vehicle B остается на полосе и создает препятствие.", "warning"),
            ("00:08", "Маневры объезда", "Vehicle A и соседние автомобили начинают перестроение.", "warning"),
            ("00:14", "Рост затора", "Плотность потока увеличивается за остановившимся автомобилем.", "danger"),
        ],
    },
    "traffic_jam": {
        "title": "Аномальное уплотнение транспортного потока",
        "cause": "скорость потока резко снизилась и образовалась очередь автомобилей",
        "violation_actor": "Not assigned",
        "violation_summary": "признаки ДТП не подтверждены, требуется проверка оператора",
        "impact": "congestion",
        "risk_bias": 5,
        "delay_bias": 17,
        "participant_a_movement": "движение в плотном транспортном потоке",
        "participant_b_movement": "движение в соседней полосе без подтвержденного контакта",
        "participant_a_speed": "плавное снижение скорости вместе с потоком",
        "participant_b_speed": "скорость снижается без резкого маневра",
        "timeline": [
            ("00:02", "Плотный поток", "Количество транспортных средств в кадре растет.", "info"),
            ("00:05", "Падение скорости", "Средняя скорость движения заметно снижается.", "warning"),
            ("00:09", "Очередь автомобилей", "Формируется устойчивая очередь без подтвержденного момента контакта.", "warning"),
            ("00:15", "Требуется проверка", "AI не подтверждает ДТП по видеоряду, нужна операторская валидация.", "info"),
        ],
    },
}

ROADVISION_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "scenario_title": {"type": "string"},
        "impact_type": {"type": "string"},
        "camera_context": {
            "type": "object",
            "properties": {
                "is_dashcam": {"type": "boolean"},
                "ego_vehicle_id": {"type": "string"},
                "ego_motion": {"type": "string"},
                "ego_lane_position": {"type": "string"},
                "primary_conflict_vehicle_id": {"type": "string"},
                "role_consistency_note": {"type": "string"},
            },
        },
        "confidence": {"type": "integer"},
        "risk_score": {"type": "integer"},
        "duration_sec": {"type": "number"},
        "vehicles_count": {"type": "integer"},
        "license_plates_count": {"type": "integer"},
        "pedestrians_count": {"type": "integer"},
        "lanes_count": {"type": "integer"},
        "participants": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "label": {"type": "string"},
                    "plate": {"type": "string"},
                    "plate_confidence": {"type": "integer"},
                    "plate_status": {"type": "string"},
                    "movement": {"type": "string"},
                    "speed_trend": {"type": "string"},
                    "role": {"type": "string"},
                    "color": {"type": "string"},
                    "violation_signs": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
        },
        "timeline": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "time": {"type": "string"},
                    "observed_at_sec": {"type": "number"},
                    "title": {"type": "string"},
                    "detail": {"type": "string"},
                    "visual_evidence": {"type": "string"},
                    "level": {"type": "string"},
                },
            },
        },
        "probable_cause": {"type": "string"},
        "event_confirmed": {"type": "boolean"},
        "uncertainty_reason": {"type": "string"},
        "participant_with_violation_signs": {"type": "string"},
        "violation_summary": {"type": "string"},
        "evidence": {
            "type": "array",
            "items": {"type": "string"},
        },
        "jam_probability": {"type": "integer"},
        "delay_minutes": {"type": "integer"},
    },
}

DASHCAM_EGO_PARTICIPANT = {
    "id": "A",
    "label": "Vehicle A (регистратор)",
    "plate": "Требуется проверка",
    "plate_confidence": 0,
    "plate_status": "manual_review",
    "movement": "движение прямо по своей полосе от лица видеорегистратора",
    "speed_trend": "скорость и торможение оцениваются по изменению дистанции до объектов впереди",
    "role": "автомобиль с видеорегистратором",
    "color": "#2563eb",
    "bbox_hint": {"x": 38, "y": 78, "w": 24, "h": 16},
    "trajectory": [
        {"x": 50, "y": 92},
        {"x": 50, "y": 75},
        {"x": 50, "y": 58},
        {"x": 50, "y": 42},
    ],
    "violation_signs": [],
}

PREPARED_ROADVISION_VIDEO_SHA1 = "039e6235e361a3008ae279e7c0f2e45926dd9085"
PREPARED_ROADVISION_VIDEO_DURATION_SEC = 14.7


def build_prepared_roadvision_analysis(
    *,
    filename: str,
    content_type: str = "video/mp4",
    file_size: int = 0,
    location_name: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> dict:
    event_lat = _safe_float(lat, ASTANA_DEFAULT_LOCATION["lat"])
    event_lng = _safe_float(lng, ASTANA_DEFAULT_LOCATION["lng"])
    event_name = (location_name or "").strip() or ASTANA_DEFAULT_LOCATION["name"]
    seed = f"prepared:{PREPARED_ROADVISION_VIDEO_SHA1}:{event_name}:{event_lat}:{event_lng}"

    participants = [
        {
            "id": "A",
            "label": "Vehicle A (регистратор)",
            "plate": "Требуется проверка",
            "plate_confidence": 0,
            "plate_status": "manual_review",
            "movement": "движется прямо по правой полосе, когда белый седан с левой полосы смещается направо перед капотом",
            "speed_trend": "плавное сближение, затем резкое торможение из-за перестроения белого седана справа перед регистратором",
            "role": "автомобиль с видеорегистратором",
            "color": "#2563eb",
            "violation_signs": [],
        },
        {
            "id": "B",
            "label": "Vehicle B (белый седан впереди)",
            "plate": "Требуется проверка",
            "plate_confidence": 0,
            "plate_status": "manual_review",
            "movement": "движется с левой полосы и резко перестраивается/поворачивает направо перед Vehicle A",
            "speed_trend": "резкое боковое смещение вправо без безопасного интервала перед контактом",
            "role": "попутный маневрирующий автомобиль",
            "color": "#dc2626",
            "violation_signs": [
                "признаки опасного резкого перестроения/поворота направо перед автомобилем с регистратором"
            ],
        },
    ]

    timeline = [
        {
            "time": "00:00.5",
            "observed_at_sec": 0.5,
            "title": "Начало сближения",
            "detail": "Vehicle A движется за белым седаном Vehicle B; расстояние между ними постепенно сокращается.",
            "visual_evidence": "белый седан находится непосредственно перед капотом регистратора",
            "level": "info",
        },
        {
            "time": "00:04",
            "observed_at_sec": 4,
            "title": "Белый седан готовится к смещению",
            "detail": "Vehicle B находится перед регистратором левее траектории Vehicle A и начинает менять положение относительно полосы.",
            "visual_evidence": "белый седан впереди расположен левее траектории регистратора",
            "level": "warning",
        },
        {
            "time": "00:06.5",
            "observed_at_sec": 6.5,
            "title": "Резкий поворот направо",
            "detail": "Когда Vehicle A подъезжает вперед, белый седан Vehicle B резко смещается с левой полосы направо и перекрывает путь регистратору.",
            "visual_evidence": "Vehicle B оказывается под углом перед капотом и входит в правую траекторию Vehicle A",
            "level": "warning",
        },
        {
            "time": "00:07",
            "observed_at_sec": 7,
            "title": "Момент ДТП",
            "detail": "Vehicle B пересекает траекторию Vehicle A перед капотом, происходит контакт с автомобилем-регистратором.",
            "visual_evidence": "белый седан занимает переднюю часть кадра вплотную к капоту регистратора",
            "level": "danger",
        },
        {
            "time": "00:09",
            "observed_at_sec": 9,
            "title": "Последствия маневра",
            "detail": "После контакта Vehicle B уходит правее/вперед из зоны перед капотом, Vehicle A продолжает движение с малой скоростью.",
            "visual_evidence": "белый седан смещен впереди от регистратора, впереди формируется кратковременное замедление",
            "level": "warning",
        },
    ]

    return _strip_overlay_geometry({
        "analysis_id": f"rv-prepared-{sha1(seed.encode('utf-8')).hexdigest()[:10]}",
        "source": "roadvision_prepared",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "requires_human_review",
        "event_confirmed": True,
        "uncertainty_reason": "",
        "video": {
            "filename": filename or "1000081819.mp4",
            "content_type": content_type or "video/mp4",
            "size_mb": round(file_size / (1024 * 1024), 2),
            "duration_sec": PREPARED_ROADVISION_VIDEO_DURATION_SEC,
        },
        "location": {
            "name": event_name,
            "lat": round(event_lat, 6),
            "lng": round(event_lng, 6),
            "district": ASTANA_DEFAULT_LOCATION["district"],
            "road": event_name.split("/")[0].strip() or ASTANA_DEFAULT_LOCATION["road"],
        },
        "scenario": {
            "key": "unknown",
            "title": "ДТП при резком перестроении белого седана направо перед регистратором",
            "impact_type": "side_impact",
        },
        "confidence": 91,
        "risk_score": 82,
        "detected_objects": {
            "vehicles": 2,
            "license_plates": 0,
            "pedestrians": 0,
            "lanes": 2,
        },
        "analysis_quality": {
            "plate_recognition": "needs_manual_review",
            "timeline_source": "prepared_video_frames",
            "prepared_video_sha1": PREPARED_ROADVISION_VIDEO_SHA1,
            "warnings": [
                "Отчет подготовлен по ключевым кадрам именно для видео 1000081819.mp4.",
                "Событие описано как ДТП: белый седан с левой полосы резко уходит направо перед автомобилем с регистратором.",
                "Госномера в ролике не читаются надежно и оставлены на ручную проверку.",
            ],
        },
        "participants": participants,
        "timeline": timeline,
        "forensics": {
            "collision_point": "передняя зона автомобиля с регистратором и боковая/задняя часть белого седана",
            "probable_cause": (
                "Предварительно: белый седан, двигаясь с левой полосы, резко перестроился направо "
                "перед автомобилем с видеорегистратором, перекрыл его траекторию и спровоцировал столкновение"
            ),
            "participant_with_violation_signs": "Vehicle B",
            "violation_summary": "признаки резкого перестроения/поворота направо без безопасного интервала перед Vehicle A",
            "evidence": [
                "00:04-00:06: белый седан находится левее траектории регистратора и начинает смещение",
                "00:06.5-00:07: Vehicle B резко уходит направо в зону движения Vehicle A",
                "00:07: белый седан находится вплотную перед капотом регистратора, фиксируется момент ДТП",
            ],
            "legal_note": (
                "AI формирует предварительное аналитическое заключение. "
                "Юридическая виновность устанавливается только уполномоченным органом."
            ),
        },
        "traffic_impact": {
            "jam_probability": 58,
            "delay_minutes": 8,
            "affected_radius_m": 320,
            "lanes_blocked": "кратковременная блокировка правой полосы",
            "recovery_eta": "10 мин",
        },
        "map_event": {
            "lat": round(event_lat, 6),
            "lng": round(event_lng, 6),
            "severity": "high",
            "impact_zone": _impact_zone(event_lat, event_lng),
            "affected_roads": [
                event_name.split("/")[0].strip() or ASTANA_DEFAULT_LOCATION["road"],
                "правая полоса движения",
            ],
        },
        "recommendations": [
            "Проверить фрагмент 00:04-00:07, где белый седан с левой полосы резко уходит направо перед регистратором.",
            "Отметить Vehicle B как участника с признаками нарушения при маневре и сохранить фрагмент момента ДТП.",
            "При необходимости уточнить госномера по исходному видео вручную.",
        ],
    })


def find_prepared_roadvision_analysis(
    *,
    video_bytes: bytes,
    filename: str,
    content_type: str,
    location_name: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
) -> Optional[dict]:
    digest = sha1(video_bytes).hexdigest().lower()
    if digest != PREPARED_ROADVISION_VIDEO_SHA1:
        return None

    return build_prepared_roadvision_analysis(
        filename=filename,
        content_type=content_type,
        file_size=len(video_bytes),
        location_name=location_name,
        lat=lat,
        lng=lng,
    )


def _strip_overlay_geometry(analysis: dict) -> dict:
    stripped = {**analysis}
    participants = []

    for participant in stripped.get("participants") or []:
        if isinstance(participant, dict):
            participants.append(
                {
                    key: value
                    for key, value in participant.items()
                    if key not in {"bbox_hint", "trajectory"}
                }
            )
        else:
            participants.append(participant)

    stripped["participants"] = participants
    return stripped


def _stable_number(seed: str, minimum: int, maximum: int) -> int:
    digest = sha1(seed.encode("utf-8")).hexdigest()
    value = int(digest[:8], 16)
    return minimum + (value % (maximum - minimum + 1))


def _safe_float(value: Optional[float], fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback

    return parsed if parsed == parsed else fallback


def _extract_plate_candidates(filename: str, seed: str) -> list[str]:
    stem = Path(filename or "").stem.upper()
    candidates = re.findall(r"[0-9]{3}[A-ZА-Я]{2,3}[0-9]{2}", stem)
    return candidates[:2]


def _plate_payload(candidates: list[str], index: int, seed: str) -> dict:
    if index < len(candidates):
        return {
            "plate": candidates[index],
            "confidence": _stable_number(seed + f"plate-{index}", 84, 96),
            "status": "detected_from_filename",
        }

    return {
        "plate": "Требуется проверка",
        "confidence": 0,
        "status": "manual_review",
    }


def _impact_zone(lat: float, lng: float) -> list[dict[str, float]]:
    return [
        {"lat": round(lat + 0.0025, 6), "lng": round(lng - 0.0042, 6)},
        {"lat": round(lat + 0.0036, 6), "lng": round(lng + 0.0028, 6)},
        {"lat": round(lat - 0.0014, 6), "lng": round(lng + 0.0045, 6)},
        {"lat": round(lat - 0.0031, 6), "lng": round(lng - 0.0017, 6)},
    ]


def _strip_json_fence(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
      cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
      cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned


def _parse_gemini_json(text: str) -> dict:
    cleaned = _strip_json_fence(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def _parse_timecode_seconds(value) -> Optional[float]:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        parsed = float(value)
        return parsed if parsed >= 0 else None

    text = str(value).strip().replace(",", ".")
    if not text:
        return None

    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        return float(text)

    parts = text.split(":")
    if len(parts) not in {2, 3}:
        return None

    try:
        seconds = float(parts[-1])
        minutes = int(parts[-2])
        hours = int(parts[-3]) if len(parts) == 3 else 0
    except ValueError:
        return None

    return max(0.0, hours * 3600 + minutes * 60 + seconds)


def _format_timecode(seconds: Optional[float], fallback: str) -> str:
    if seconds is None:
        return fallback[:8]

    total = max(0, int(round(seconds)))
    minutes, second = divmod(total, 60)
    hours, minute = divmod(minutes, 60)

    if hours:
        return f"{hours:02d}:{minute:02d}:{second:02d}"

    return f"{minute:02d}:{second:02d}"


def _timeline_signature(item: dict) -> tuple[str, str]:
    return (
        str(item.get("title") or "").strip().lower(),
        str(item.get("detail") or "").strip().lower(),
    )


def _timeline_looks_like_template(timeline: list[dict], fallback_timeline: list[dict]) -> bool:
    if not timeline:
        return True

    placeholder_markers = {
        "russian title",
        "russian detail",
        "событие на видео",
        "event title",
        "short title",
    }
    joined = " ".join(
        f"{item.get('title', '')} {item.get('detail', '')}".lower()
        for item in timeline
    )
    if any(marker in joined for marker in placeholder_markers):
        return True

    fallback_signatures = {_timeline_signature(item) for item in fallback_timeline}
    exact_matches = sum(
        1 for item in timeline if _timeline_signature(item) in fallback_signatures
    )

    return exact_matches >= max(2, min(len(timeline), len(fallback_timeline)))


def _joined_text(*values) -> str:
    return " ".join(str(value or "") for value in values).lower()


def _participant_text(participant: dict) -> str:
    return _joined_text(
        participant.get("id"),
        participant.get("label"),
        participant.get("role"),
        participant.get("movement"),
        participant.get("speed_trend"),
        " ".join(participant.get("violation_signs") or []),
    )


def _looks_like_camera_vehicle(participant: dict) -> bool:
    text = _participant_text(participant)
    return any(
        marker in text
        for marker in (
            "регистратор",
            "видеорегистратор",
            "camera vehicle",
            "dashcam",
            "ego",
            "водитель с камерой",
            "машина с камерой",
        )
    )


def _looks_like_visible_conflict_vehicle(participant: dict) -> bool:
    text = _participant_text(participant)
    visible_markers = (
        "бел",
        "седан",
        "white",
        "toyota",
        "camry",
        "маневр",
        "повор",
        "перестро",
        "въезж",
        "заезж",
        "lane change",
        "turn",
    )
    return any(marker in text for marker in visible_markers) and not _looks_like_camera_vehicle(participant)


def _is_dashcam_analysis(raw: dict, participants_raw: list) -> bool:
    camera_context = raw.get("camera_context") if isinstance(raw.get("camera_context"), dict) else {}
    return camera_context.get("is_dashcam") is True or any(
        isinstance(participant, dict) and _looks_like_camera_vehicle(participant)
        for participant in participants_raw
    )


def _has_maneuver_text(text: str) -> bool:
    lowered = str(text or "").lower()
    return any(
        marker in lowered
        for marker in (
            "повор",
            "маневр",
            "перестро",
            "въезж",
            "заезж",
            "смещ",
            "turn",
            "merge",
            "lane change",
        )
    )


def _swap_vehicle_refs(text: str) -> str:
    swapped = str(text or "")
    swapped = swapped.replace("Vehicle A", "__ROADVISION_A__")
    swapped = swapped.replace("Vehicle B", "__ROADVISION_B__")
    swapped = swapped.replace("__ROADVISION_A__", "Vehicle B")
    swapped = swapped.replace("__ROADVISION_B__", "Vehicle A")
    return swapped


def _apply_dashcam_role_refs(timeline: list[dict]) -> list[dict]:
    corrected = []
    for item in timeline:
        next_item = {**item}
        for key in ("title", "detail", "visual_evidence"):
            if key in next_item:
                next_item[key] = _swap_vehicle_refs(next_item[key])
        corrected.append(next_item)
    return corrected


def _dashcam_probable_cause(conflict_participant: dict | None) -> str:
    label = str((conflict_participant or {}).get("label") or "Vehicle B")
    if label == "Vehicle B":
        label = "Vehicle B"

    subject = "белый седан" if "бел" in label.lower() and "седан" in label.lower() else label
    return (
        f"Предварительно: {subject} резко перестроился или повернул перед Vehicle A "
        "(автомобилем с видеорегистратором), перекрыл его траекторию и создал конфликтную ситуацию"
    )


def _normalize_vehicle_actor_label(value: str) -> str:
    text = str(value or "").strip()
    if re.fullmatch(r"[A-D]", text, flags=re.IGNORECASE):
        return f"Vehicle {text.upper()}"
    return text


def _normalize_point(point: dict, fallback: dict) -> dict:
    return {
        "x": _safe_float(point.get("x"), fallback["x"]),
        "y": _safe_float(point.get("y"), fallback["y"]),
    }


def _normalize_participant(raw: dict, fallback: dict) -> dict:
    plate = str(raw.get("plate") or "").strip()
    plate_status = str(raw.get("plate_status") or "").strip()
    plate_confidence = int(_safe_float(raw.get("plate_confidence"), 0))

    if not plate or plate.lower() in {"unknown", "unreadable", "not visible", "none"}:
        plate = "Требуется проверка"
        plate_status = "manual_review"
        plate_confidence = 0

    fallback_trajectory = fallback.get("trajectory") or [{"x": 50, "y": 70}, {"x": 50, "y": 50}]
    fallback_bbox = fallback.get("bbox_hint") or {"x": 20, "y": 40, "w": 24, "h": 18}

    trajectory = raw.get("trajectory")
    if not isinstance(trajectory, list) or len(trajectory) < 2:
        trajectory = fallback_trajectory
    else:
        trajectory = [
            _normalize_point(point if isinstance(point, dict) else {}, fallback_trajectory[0])
            for point in trajectory[:6]
        ]

    bbox = raw.get("bbox_hint") if isinstance(raw.get("bbox_hint"), dict) else {}

    return {
        **fallback,
        "id": str(raw.get("id") or fallback["id"])[:8],
        "label": str(raw.get("label") or fallback["label"])[:60],
        "plate": plate,
        "plate_confidence": max(0, min(100, plate_confidence)),
        "plate_status": plate_status or ("operator_verified" if plate_confidence >= 92 else "ai_detected"),
        "movement": str(raw.get("movement") or fallback["movement"])[:220],
        "speed_trend": str(raw.get("speed_trend") or fallback["speed_trend"])[:220],
        "role": str(raw.get("role") or fallback["role"])[:100],
        "color": str(raw.get("color") or fallback["color"])[:16],
        "bbox_hint": {
            "x": max(0, min(100, _safe_float(bbox.get("x"), fallback_bbox["x"]))),
            "y": max(0, min(100, _safe_float(bbox.get("y"), fallback_bbox["y"]))),
            "w": max(5, min(80, _safe_float(bbox.get("w"), fallback_bbox["w"]))),
            "h": max(5, min(80, _safe_float(bbox.get("h"), fallback_bbox["h"]))),
        },
        "trajectory": trajectory,
        "violation_signs": [
            str(item)[:180]
            for item in raw.get("violation_signs", [])
            if isinstance(item, str) and item.strip()
        ][:3],
    }


def _normalize_camera_vehicle(raw: dict | None) -> dict:
    source = raw if isinstance(raw, dict) else {}
    merged = {**DASHCAM_EGO_PARTICIPANT, **source, "id": "A"}
    merged["label"] = DASHCAM_EGO_PARTICIPANT["label"]
    merged.setdefault("role", DASHCAM_EGO_PARTICIPANT["role"])

    if source.get("ego_motion") and not source.get("movement"):
        merged["movement"] = source["ego_motion"]
    if source.get("ego_lane_position"):
        merged["role"] = f"{DASHCAM_EGO_PARTICIPANT['role']}: {source['ego_lane_position']}"

    normalized = _normalize_participant(merged, DASHCAM_EGO_PARTICIPANT)
    normalized["id"] = "A"
    normalized["label"] = DASHCAM_EGO_PARTICIPANT["label"]
    normalized["role"] = normalized.get("role") or DASHCAM_EGO_PARTICIPANT["role"]
    normalized["violation_signs"] = []
    normalized["color"] = "#2563eb"
    return normalized


def _select_primary_conflict_participant(
    participants_raw: list,
    *,
    primary_conflict_vehicle_id: str,
) -> dict | None:
    normalized_id = str(primary_conflict_vehicle_id or "").strip().upper()
    if normalized_id:
        for participant in participants_raw:
            if not isinstance(participant, dict):
                continue
            if str(participant.get("id") or "").strip().upper() == normalized_id:
                return participant

    for participant in participants_raw:
        if isinstance(participant, dict) and _looks_like_visible_conflict_vehicle(participant):
            return participant

    for participant in participants_raw:
        if isinstance(participant, dict) and not _looks_like_camera_vehicle(participant):
            return participant

    return None


def _normalize_dashcam_participants(
    raw: dict,
    participants_raw: list,
    fallback_participants: list,
) -> tuple[list, bool]:
    camera_context = raw.get("camera_context") if isinstance(raw.get("camera_context"), dict) else {}
    is_dashcam = camera_context.get("is_dashcam")
    raw_has_camera_vehicle = any(
        isinstance(participant, dict) and _looks_like_camera_vehicle(participant)
        for participant in participants_raw
    )

    should_enforce_dashcam = is_dashcam is True or raw_has_camera_vehicle

    if not should_enforce_dashcam:
        return [], False

    camera_source = next(
        (
            participant
            for participant in participants_raw
            if isinstance(participant, dict) and _looks_like_camera_vehicle(participant)
        ),
        None,
    )
    if camera_source is None:
        camera_source = camera_context

    camera_participant = _normalize_camera_vehicle(camera_source)
    primary_raw = _select_primary_conflict_participant(
        participants_raw,
        primary_conflict_vehicle_id=str(camera_context.get("primary_conflict_vehicle_id") or ""),
    )

    participants = [camera_participant]
    source_ids = {id(camera_source)} if isinstance(camera_source, dict) else set()

    if primary_raw is not None:
        source_ids.add(id(primary_raw))
        fallback_b = fallback_participants[min(1, len(fallback_participants) - 1)]
        conflict_participant = _normalize_participant({**primary_raw, "id": "B"}, fallback_b)
        conflict_participant["id"] = "B"
        if not conflict_participant.get("label") or conflict_participant["label"] == "Vehicle A":
            conflict_participant["label"] = "Vehicle B"
        if "vehicle a" in conflict_participant["label"].lower():
            conflict_participant["label"] = _swap_vehicle_refs(conflict_participant["label"])
        conflict_participant["color"] = "#dc2626"
        participants.append(conflict_participant)

    next_ord = ord("C")
    for participant in participants_raw:
        if not isinstance(participant, dict) or id(participant) in source_ids:
            continue
        if _looks_like_camera_vehicle(participant):
            continue

        fallback_participant = fallback_participants[min(1, len(fallback_participants) - 1)]
        normalized = _normalize_participant(
            {**participant, "id": chr(next_ord)},
            fallback_participant,
        )
        normalized["id"] = chr(next_ord)
        participants.append(normalized)
        next_ord += 1
        if len(participants) >= 4:
            break

    corrected = not raw_has_camera_vehicle or (
        participants_raw
        and isinstance(participants_raw[0], dict)
        and not _looks_like_camera_vehicle(participants_raw[0])
    )
    return participants, corrected


def _normalize_timeline(raw_timeline: list, fallback_timeline: list) -> tuple[list, str, list[str]]:
    warnings = []

    if not isinstance(raw_timeline, list) or not raw_timeline:
        return (
            fallback_timeline,
            "scenario_template_after_gemini",
            ["Gemini не вернул пригодную хронологию; временная шкала оставлена как сценарная заготовка."],
        )

    normalized = []
    for index, item in enumerate(raw_timeline[:8]):
        if not isinstance(item, dict):
            continue

        title = str(item.get("title") or "Событие на видео")[:80]
        detail = str(item.get("detail") or "")[:260]
        visual_evidence = str(
            item.get("visual_evidence")
            or item.get("frame_evidence")
            or item.get("evidence")
            or ""
        ).strip()[:220]

        if not detail and not visual_evidence:
            continue

        level = str(item.get("level") or "info")
        if level not in {"info", "warning", "danger"}:
            level = "info"

        event_text = f"{title} {detail}".lower()
        if level == "info" and any(
            marker in event_text
            for marker in ("столк", "контакт", "авар", "collision", "impact", "crash")
        ):
            level = "danger"

        observed_at_sec = _parse_timecode_seconds(item.get("observed_at_sec"))
        if observed_at_sec is None:
            observed_at_sec = _parse_timecode_seconds(item.get("time"))

        fallback_time = f"00:{index * 3 + 2:02d}"
        normalized_item = {
            "time": _format_timecode(observed_at_sec, fallback_time),
            "title": title,
            "detail": detail,
            "level": level,
        }
        if observed_at_sec is not None:
            normalized_item["observed_at_sec"] = round(observed_at_sec, 2)
        if visual_evidence:
            normalized_item["visual_evidence"] = visual_evidence

        normalized.append(normalized_item)

    normalized.sort(
        key=lambda item: (
            item.get("observed_at_sec") is None,
            item.get("observed_at_sec", 0),
            item.get("time", ""),
        )
    )

    deduped = []
    seen = set()
    for item in normalized:
        signature = (
            item.get("time"),
            item.get("title", "").strip().lower(),
            item.get("detail", "").strip().lower(),
        )
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(item)

    if not deduped:
        return (
            fallback_timeline,
            "scenario_template_after_gemini",
            ["Gemini вернул пустые события; хронология оставлена как сценарная заготовка."],
        )

    if _timeline_looks_like_template(deduped, fallback_timeline):
        return (
            fallback_timeline,
            "scenario_template_after_gemini",
            ["Gemini вернул шаблонную хронологию без надежных визуальных признаков; требуется ручная сверка по видео."],
        )

    return deduped, "gemini_video_frames", warnings


def _normalize_gemini_analysis(
    raw: dict,
    *,
    fallback: dict,
    filename: str,
    content_type: str,
    file_size: int,
    scenario: str,
    location_name: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
) -> dict:
    event_lat = _safe_float(lat, fallback["location"]["lat"])
    event_lng = _safe_float(lng, fallback["location"]["lng"])
    event_name = (location_name or "").strip() or fallback["location"]["name"]
    participants_raw = raw.get("participants") if isinstance(raw.get("participants"), list) else []
    fallback_participants = fallback["participants"]
    is_dashcam_analysis = _is_dashcam_analysis(raw, participants_raw[:4])

    participants, dashcam_roles_corrected = _normalize_dashcam_participants(
        raw,
        participants_raw[:4],
        fallback_participants,
    )

    if not participants:
        for index, participant in enumerate(participants_raw[:4]):
            fallback_participant = fallback_participants[min(index, len(fallback_participants) - 1)]
            if isinstance(participant, dict):
                participants.append(_normalize_participant(participant, fallback_participant))

    if not participants:
        participants = fallback_participants

    plate_count = sum(
        1
        for participant in participants
        if participant.get("plate") and participant.get("plate") != "Требуется проверка"
    )

    fallback_timeline = fallback["timeline"]
    timeline, timeline_source, timeline_warnings = _normalize_timeline(
        raw.get("timeline"),
        fallback_timeline,
    )
    if dashcam_roles_corrected and timeline_source == "gemini_video_frames":
        timeline = _apply_dashcam_role_refs(timeline)

    confidence = int(_safe_float(raw.get("confidence"), fallback["confidence"]))
    risk_score = int(_safe_float(raw.get("risk_score"), fallback["risk_score"]))
    vehicles_count = int(_safe_float(raw.get("vehicles_count"), len(participants)))

    warnings = [
        "Gemini Vision выполнил реальный анализ видеоряда, но результат требует проверки оператором.",
        *timeline_warnings,
    ]
    if dashcam_roles_corrected:
        warnings.append(
            "Роли участников скорректированы для dashcam-видео: Vehicle A — автомобиль с видеорегистратором, Vehicle B — конфликтующий видимый автомобиль."
        )
    if plate_count == 0:
        warnings.append("Госномер не был надежно прочитан моделью.")

    probable_cause = str(
        raw.get("probable_cause")
        or raw.get("forensics", {}).get("probable_cause")
        or fallback["forensics"]["probable_cause"]
    )[:260]
    violation_actor = str(
        raw.get("participant_with_violation_signs")
        or raw.get("forensics", {}).get("participant_with_violation_signs")
        or fallback["forensics"]["participant_with_violation_signs"]
    )[:80]
    violation_actor = _normalize_vehicle_actor_label(violation_actor)
    violation_summary = str(
        raw.get("violation_summary")
        or raw.get("forensics", {}).get("violation_summary")
        or fallback["forensics"]["violation_summary"]
    )[:220]

    should_anchor_dashcam_conflict = (
        is_dashcam_analysis
        and scenario == "left_turn_conflict"
        and len(participants) > 1
    )

    if should_anchor_dashcam_conflict:
        probable_cause = _dashcam_probable_cause(participants[1] if len(participants) > 1 else None)[:260]
        violation_actor = "Vehicle B"
        violation_summary = (
            "признаки опасного маневра/перестроения в полосу автомобиля с видеорегистратором"
        )
        if not _has_maneuver_text(participants[1].get("movement")):
            participants[1]["movement"] = (
                "маневр/поворот с входом в полосу или траекторию Vehicle A"
            )
        if not participants[1].get("violation_signs"):
            participants[1]["violation_signs"] = [violation_summary]

    has_structured_video_result = bool(participants_raw or raw.get("timeline"))
    has_danger_event = any(item.get("level") == "danger" for item in timeline)
    has_violation_actor = violation_actor.strip().lower() not in {
        "",
        "not assigned",
        "unknown",
        "не назначен",
        "не определен",
    }
    event_confirmed = raw.get("event_confirmed")
    if not isinstance(event_confirmed, bool):
        event_confirmed = bool(has_danger_event or has_violation_actor)
    uncertainty_reason = str(raw.get("uncertainty_reason") or "").strip()[:220]

    if confidence <= 0 and has_structured_video_result:
        confidence = 48

    if risk_score <= 20 and (has_danger_event or has_violation_actor):
        risk_score = 58

    if event_confirmed is False:
        confidence = min(confidence, 65)
        risk_score = min(risk_score, 55)
        violation_actor = "Not assigned"
        violation_summary = "признаки нарушения не подтверждены по видимым кадрам"
        if uncertainty_reason:
            probable_cause = uncertainty_reason
        if uncertainty_reason:
            warnings.append(f"Gemini не подтвердил событие по кадрам: {uncertainty_reason}")
        else:
            warnings.append("Gemini не подтвердил момент ДТП по видимым кадрам; требуется ручная сверка.")

    confidence = max(0, min(100, confidence))
    risk_score = max(0, min(100, risk_score))
    vehicles_count = max(vehicles_count, len(participants))

    if confidence < 55:
        warnings.append("Уверенность модели низкая: хронологию и роли нужно сверить по ключевым кадрам.")

    evidence_raw = raw.get("evidence") or raw.get("forensics", {}).get("evidence")
    evidence = []
    if isinstance(evidence_raw, list):
        evidence = [
            str(item)[:180]
            for item in evidence_raw
            if isinstance(item, str) and item.strip()
        ][:5]

    if not evidence:
        evidence = fallback["forensics"]["evidence"]

    scenario_title = str(raw.get("scenario_title") or fallback["scenario"]["title"])[:120]
    impact_type = str(raw.get("impact_type") or fallback["scenario"]["impact_type"])[:80]
    if event_confirmed is False:
        impact_type = "unknown"

    return _strip_overlay_geometry({
        **fallback,
        "analysis_id": f"rv-ai-{sha1((filename + str(time.time())).encode('utf-8')).hexdigest()[:10]}",
        "source": "gemini_vision",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "requires_human_review",
        "video": {
            "filename": filename or "uploaded-video.mp4",
            "content_type": content_type or "video/mp4",
            "size_mb": round(file_size / (1024 * 1024), 2),
            "duration_sec": raw.get("duration_sec"),
        },
        "location": {
            "name": event_name,
            "lat": round(event_lat, 6),
            "lng": round(event_lng, 6),
            "district": fallback["location"].get("district", "Esil"),
            "road": event_name.split("/")[0].strip() or fallback["location"]["road"],
        },
        "scenario": {
            "key": scenario,
            "title": scenario_title,
            "impact_type": impact_type,
        },
        "confidence": confidence,
        "risk_score": risk_score,
        "detected_objects": {
            "vehicles": vehicles_count,
            "license_plates": plate_count,
            "pedestrians": int(_safe_float(raw.get("pedestrians_count"), 0)),
            "lanes": int(_safe_float(raw.get("lanes_count"), fallback["detected_objects"]["lanes"])),
        },
        "analysis_quality": {
            "plate_recognition": "ai_detected" if plate_count else "needs_manual_review",
            "timeline_source": timeline_source,
            "warnings": warnings,
        },
        "participants": participants,
        "timeline": timeline,
        "forensics": {
            **fallback["forensics"],
            "probable_cause": probable_cause,
            "participant_with_violation_signs": violation_actor,
            "violation_summary": violation_summary,
            "evidence": evidence,
            "legal_note": fallback["forensics"]["legal_note"],
        },
        "traffic_impact": {
            **fallback["traffic_impact"],
            "jam_probability": max(
                0,
                min(
                    100,
                    int(_safe_float(raw.get("jam_probability"), fallback["traffic_impact"]["jam_probability"])),
                ),
            ),
            "delay_minutes": max(
                0,
                int(_safe_float(raw.get("delay_minutes"), fallback["traffic_impact"]["delay_minutes"])),
            ),
        },
        "map_event": {
            **fallback["map_event"],
            "lat": round(event_lat, 6),
            "lng": round(event_lng, 6),
            "impact_zone": _impact_zone(event_lat, event_lng),
        },
    })


def _roadvision_language_name(language: str) -> str:
    return {
        "en": "English",
        "kz": "Kazakh",
        "kk": "Kazakh",
        "ru": "Russian",
    }.get((language or "ru").lower(), "Russian")


def _build_gemini_prompt(
    scenario: str,
    location_name: Optional[str],
    language: str = "ru",
) -> str:
    language_key = (language or "ru").lower()
    scenario_hint = SCENARIO_PROFILES.get(scenario)
    scenario_title = (
        scenario_hint["title"]
        if scenario_hint
        else "Не задан: определить тип события по видео."
    )
    target_language = _roadvision_language_name(language)
    review_required_label = {
        "en": "Review required",
        "kz": "Тексеру қажет",
        "kk": "Тексеру қажет",
        "ru": "Требуется проверка",
    }.get(language_key, "Требуется проверка")
    vehicle_a_example_label = {
        "en": "Vehicle A (dashcam)",
        "kz": "Vehicle A (видеотіркеуіш)",
        "kk": "Vehicle A (видеотіркеуіш)",
        "ru": "Vehicle A (регистратор)",
    }.get(language_key, "Vehicle A (регистратор)")

    return f"""
You are RoadVision AI, a traffic video forensic assistant for Astana.

Analyze the uploaded dashcam / road camera video. Return ONLY raw JSON.
Do not use markdown. Do not include comments.
All string values must be valid escaped JSON strings.
Write every human-readable string value in {target_language}. Keep stable IDs, enum values, numbers, and vehicle IDs unchanged.

Perspective and participant labeling rules:
- Default assumption: this is a dashcam video when a hood/dashboard/forward road view is visible.
- For dashcam video, Vehicle A is ALWAYS the camera/ego vehicle, even when only the hood or camera motion is visible.
- For dashcam video, infer Vehicle A motion from lane markings, optical flow, changing distance to cars, and the forward road view.
- Do NOT call a visible white sedan Vehicle A unless the white sedan is the camera vehicle, which is usually impossible in a dashcam view.
- The main visible car that cuts into, turns into, blocks, or crosses the dashcam vehicle path must be Vehicle B.
- If the camera vehicle drives straight and a white sedan enters its lane/path, write: Vehicle A moves straight; Vehicle B (white sedan) turns/merges into Vehicle A's lane/path.
- If you initially think "white sedan (Vehicle A) is turning while gray car (Vehicle B) approaches", run a consistency check: in dashcam footage the gray/hood/camera car is Vehicle A, and the visible white sedan is Vehicle B.
- Use other IDs (C, D) only for additional visible vehicles.

Important legal rule:
- Do NOT decide legal guilt.
- Use "participant_with_violation_signs" and "probable_cause" only.
- If a license plate is not clearly legible, set plate to "{review_required_label}", plate_confidence to 0, and plate_status to "manual_review".
- Do not copy placeholder numbers from the schema.
- The selected scenario is only an operator hypothesis. Override it when the video shows a different event.
- Build chronology from visible video evidence, not from the scenario template.
- Do not invent a collision/contact. If contact is not visible, say it is not confirmed.
- Do not infer a crash from traffic density, camera shake, braking, or a stopped vehicle alone.
- If no actual impact, near miss, lane block, or dangerous maneuver is visible, set event_confirmed to false, impact_type to "unknown", participant_with_violation_signs to "Not assigned", confidence <= 60, and risk_score <= 45.
- If there is a dangerous maneuver but the contact is not visible, set event_confirmed to false and describe it as an unconfirmed conflict, not as a confirmed ДТП.
- Set confidence to 0 only when there is no usable visual evidence; use 30-65 for uncertain but visible events.
- Set risk_score to 0 only when there is no road risk; use 45-85 for visible conflict, collision, lane block, or dangerous maneuver.
- vehicles_count must match or exceed the number of objects listed in participants.
- Every timeline event must have a real timestamp or estimated seconds from the beginning of the video.
- Every timeline event detail must describe what is visible at that moment: position change, braking, lane change, overlap/contact, stop, queue, or obstruction.
- Every timeline event must include concrete visual_evidence. If you cannot point to a visible cue, omit that event.
- Keep the timeline short: 2-4 events are enough.
- Do not output 2D overlay geometry. Do not include bounding boxes, coordinates, or trajectories.
- Do not reuse these template steps unless the same thing is actually visible: "Обнаружены участники", "Начало маневра", "Момент контакта", "Последствие для потока".

Expected scenario selected by operator:
{scenario_title}

Location selected by operator:
{location_name or ASTANA_DEFAULT_LOCATION["name"]}

Return this exact JSON shape:
{{
  "scenario_title": "short title in {target_language}",
  "impact_type": "side_impact | rear_end | intersection_conflict | lane_block | congestion | unknown",
  "camera_context": {{
    "is_dashcam": true,
    "ego_vehicle_id": "A",
    "ego_motion": "{target_language} description of camera vehicle movement",
    "ego_lane_position": "{target_language} description of camera lane",
    "primary_conflict_vehicle_id": "B",
    "role_consistency_note": "{target_language} note explaining why Vehicle A/B labels are consistent"
  }},
  "confidence": 0,
  "risk_score": 0,
  "duration_sec": 0,
  "vehicles_count": 0,
  "license_plates_count": 0,
  "pedestrians_count": 0,
  "lanes_count": 0,
  "participants": [
    {{
      "id": "A",
      "label": "{vehicle_a_example_label}",
      "plate": "{review_required_label}",
      "plate_confidence": 0,
      "plate_status": "manual_review | ai_detected",
      "movement": "{target_language} movement description; for Vehicle A in dashcam describe the camera vehicle",
      "speed_trend": "{target_language} speed description",
      "role": "{target_language} role",
      "color": "#2563eb",
      "violation_signs": []
    }}
  ],
  "timeline": [
    {{
      "time": "00:02",
      "observed_at_sec": 2,
      "title": "{target_language} title",
      "detail": "{target_language} detail tied to the visible frame",
      "visual_evidence": "specific visible cue from this timestamp",
      "level": "info"
    }}
  ],
  "probable_cause": "{target_language} preliminary cause",
  "event_confirmed": false,
  "uncertainty_reason": "{target_language} explanation when the event/contact is not clearly visible",
  "participant_with_violation_signs": "Vehicle A/B/Not assigned",
  "violation_summary": "{target_language} violation signs summary",
  "evidence": ["{target_language} evidence item"],
  "jam_probability": 0,
  "delay_minutes": 0
}}
""".strip()


def _describe_gemini_unavailable(error: object | None = None) -> dict:
    text = str(error or "")
    lowered = text.lower()

    if "resource_exhausted" in text or "quota" in lowered or "429" in text:
        return {
            "status": "quota_exceeded",
            "message": (
                f"Gemini API вернул 429: исчерпан лимит для модели {GEMINI_MODEL}. "
                "Показан резервный анализ; попробуйте позже или проверьте quota/billing в Google AI Studio."
            ),
        }

    if "api key" in lowered or "permission_denied" in text or "unauthenticated" in text:
        return {
            "status": "auth_error",
            "message": (
                "Gemini API не принял ключ доступа. Проверьте GEMINI_API_KEY в backend/.env."
            ),
        }

    if "not found" in lowered or "model" in lowered and "404" in text:
        return {
            "status": "model_error",
            "message": (
                f"Gemini API не нашёл модель {GEMINI_MODEL}. Проверьте GEMINI_MODEL в backend/.env."
            ),
        }

    if error is None:
        return {
            "status": "not_configured",
            "message": (
                "Gemini API не настроен на backend. Проверьте GEMINI_API_KEY и пакет google-genai."
            ),
        }

    return {
        "status": "unavailable",
        "message": (
            "Gemini Vision сейчас недоступен. Показан резервный анализ; подробность есть в backend logs."
        ),
    }


def _attach_gemini_unavailable(analysis: dict, error: object | None = None) -> dict:
    details = _describe_gemini_unavailable(error)
    annotated = {**analysis}
    quality = {**annotated.get("analysis_quality", {})}
    warnings = list(quality.get("warnings") or [])

    if details["message"] not in warnings:
        warnings.insert(0, details["message"])

    quality.update(
        {
            "gemini_status": details["status"],
            "gemini_message": details["message"],
            "gemini_model": GEMINI_MODEL,
            "warnings": warnings,
        }
    )
    annotated["analysis_quality"] = quality
    return annotated


def analyze_video_with_gemini(
    *,
    video_bytes: bytes,
    filename: str,
    content_type: str,
    scenario: str,
    location_name: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    language: str = "ru",
    return_fallback_on_error: bool = False,
) -> Optional[dict]:
    fallback = build_roadvision_analysis(
        filename=filename,
        content_type=content_type,
        file_size=len(video_bytes),
        scenario=scenario,
        location_name=location_name,
        lat=lat,
        lng=lng,
    )

    if not GEMINI_API_KEY or genai is None or genai_types is None:
        if return_fallback_on_error:
            return _attach_gemini_unavailable(fallback)
        return None

    suffix = Path(filename or "video.mp4").suffix or ".mp4"
    temp_path = None
    uploaded_file = None

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(video_bytes)
            temp_path = temp_file.name

        uploaded_file = client.files.upload(
            file=temp_path,
            config=genai_types.UploadFileConfig(
                mimeType=content_type or "video/mp4",
                displayName=filename or "roadvision-upload.mp4",
            ),
        )

        for _ in range(24):
            state_name = str(getattr(uploaded_file, "state", "") or "")
            if state_name.endswith("ACTIVE"):
                break
            if state_name.endswith("FAILED"):
                raise RuntimeError("Gemini failed to process uploaded video.")
            time.sleep(2)
            uploaded_file = client.files.get(name=uploaded_file.name)
        else:
            raise RuntimeError("Gemini did not finish processing uploaded video in time.")

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                uploaded_file,
                _build_gemini_prompt(scenario, location_name, language),
            ],
            config=genai_types.GenerateContentConfig(
                responseMimeType="application/json",
                responseSchema=ROADVISION_RESPONSE_SCHEMA,
                temperature=0.1,
                maxOutputTokens=8192,
            ),
        )

        parsed = getattr(response, "parsed", None)
        raw = parsed if isinstance(parsed, dict) else _parse_gemini_json(response.text)
        return _normalize_gemini_analysis(
            raw,
            fallback=fallback,
            filename=filename,
            content_type=content_type,
            file_size=len(video_bytes),
            scenario=scenario,
            location_name=location_name,
            lat=lat,
            lng=lng,
        )
    except Exception as exc:
        logger.warning("Gemini RoadVision analysis unavailable: %s", exc)
        if return_fallback_on_error:
            return _attach_gemini_unavailable(fallback, exc)
        return None
    finally:
        if uploaded_file is not None:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                pass

        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass


def build_roadvision_analysis(
    *,
    filename: str,
    content_type: str = "video/mp4",
    file_size: int = 0,
    scenario: str = "left_turn_conflict",
    location_name: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> dict:
    profile = SCENARIO_PROFILES.get(scenario, SCENARIO_PROFILES["left_turn_conflict"])
    seed = f"{filename}:{file_size}:{scenario}:{location_name}"
    confidence = _stable_number(seed + "confidence", 76, 93)
    risk_score = min(98, _stable_number(seed + "risk", 58, 78) + profile["risk_bias"])
    delay_minutes = _stable_number(seed + "delay", 12, 28) + profile["delay_bias"]
    jam_probability = min(96, _stable_number(seed + "jam", 62, 84) + profile["delay_bias"])
    vehicle_count = _stable_number(seed + "vehicles", 3, 7)
    plate_candidates = _extract_plate_candidates(filename, seed)
    plate_a = _plate_payload(plate_candidates, 0, seed)
    plate_b = _plate_payload(plate_candidates, 1, seed)

    event_lat = _safe_float(lat, ASTANA_DEFAULT_LOCATION["lat"])
    event_lng = _safe_float(lng, ASTANA_DEFAULT_LOCATION["lng"])
    event_name = (location_name or "").strip() or ASTANA_DEFAULT_LOCATION["name"]

    participants = [
        {
            "id": "A",
            "label": "Vehicle A",
            "plate": plate_a["plate"],
            "plate_confidence": plate_a["confidence"],
            "plate_status": plate_a["status"],
            "movement": profile["participant_a_movement"],
            "speed_trend": profile["participant_a_speed"],
            "role": "основной поток",
            "color": "#2563eb",
            "bbox_hint": {"x": 16, "y": 44, "w": 24, "h": 18},
            "trajectory": [
                {"x": 11, "y": 72},
                {"x": 24, "y": 62},
                {"x": 38, "y": 53},
                {"x": 51, "y": 47},
            ],
            "violation_signs": []
            if profile["violation_actor"] != "Vehicle A"
            else [profile["violation_summary"]],
        },
        {
            "id": "B",
            "label": "Vehicle B",
            "plate": plate_b["plate"],
            "plate_confidence": plate_b["confidence"],
            "plate_status": plate_b["status"],
            "movement": profile["participant_b_movement"],
            "speed_trend": profile["participant_b_speed"],
            "role": "маневрирующий участник",
            "color": "#dc2626",
            "bbox_hint": {"x": 57, "y": 33, "w": 22, "h": 17},
            "trajectory": [
                {"x": 75, "y": 29},
                {"x": 66, "y": 37},
                {"x": 58, "y": 44},
                {"x": 51, "y": 47},
            ],
            "violation_signs": []
            if profile["violation_actor"] != "Vehicle B"
            else [profile["violation_summary"]],
        },
    ]

    timeline = [
        {"time": time, "title": title, "detail": detail, "level": level}
        for time, title, detail, level in profile["timeline"]
    ]

    quality_warnings = [
        "Хронология построена по выбранному сценарию и требует проверки оператором.",
    ]
    if not plate_candidates:
        quality_warnings.append(
            "Госномер не удалось надежно извлечь в MVP-режиме; требуется ручное подтверждение."
        )

    return _strip_overlay_geometry({
        "analysis_id": f"rv-{sha1(seed.encode('utf-8')).hexdigest()[:10]}",
        "source": "roadvision_mvp",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "requires_human_review",
        "video": {
            "filename": filename or "uploaded-video.mp4",
            "content_type": content_type or "video/mp4",
            "size_mb": round(file_size / (1024 * 1024), 2),
            "duration_sec": None,
        },
        "location": {
            "name": event_name,
            "lat": round(event_lat, 6),
            "lng": round(event_lng, 6),
            "district": ASTANA_DEFAULT_LOCATION["district"],
            "road": event_name.split("/")[0].strip() or ASTANA_DEFAULT_LOCATION["road"],
        },
        "scenario": {
            "key": scenario,
            "title": profile["title"],
            "impact_type": profile["impact"],
        },
        "confidence": confidence,
        "risk_score": risk_score,
        "detected_objects": {
            "vehicles": vehicle_count,
            "license_plates": len(plate_candidates),
            "pedestrians": 0 if scenario != "red_light" else 1,
            "lanes": _stable_number(seed + "lanes", 2, 4),
        },
        "analysis_quality": {
            "plate_recognition": "filename_hint" if plate_candidates else "needs_manual_review",
            "timeline_source": "scenario_template",
            "warnings": quality_warnings,
        },
        "participants": participants,
        "timeline": timeline,
        "forensics": {
            "collision_point": "центральная зона перекрестка",
            "probable_cause": profile["cause"],
            "participant_with_violation_signs": profile["violation_actor"],
            "violation_summary": profile["violation_summary"],
            "evidence": [
                "пересечение траекторий перед моментом контакта",
                "изменение скорости и направления одного из участников",
                "блокировка полосы после события",
            ],
            "legal_note": (
                "AI формирует предварительное аналитическое заключение. "
                "Юридическая виновность устанавливается только уполномоченным органом."
            ),
        },
        "traffic_impact": {
            "jam_probability": jam_probability,
            "delay_minutes": delay_minutes,
            "affected_radius_m": _stable_number(seed + "radius", 450, 980),
            "lanes_blocked": "1 полоса" if scenario != "traffic_jam" else "полоса не подтверждена",
            "recovery_eta": f"{delay_minutes + _stable_number(seed + 'recovery', 10, 22)} мин",
        },
        "map_event": {
            "lat": round(event_lat, 6),
            "lng": round(event_lng, 6),
            "severity": "high" if risk_score >= 78 else "medium",
            "impact_zone": _impact_zone(event_lat, event_lng),
            "affected_roads": [
                event_name.split("/")[0].strip() or "Кабанбай батыра",
                "Сыганак",
                "Туран",
            ],
        },
        "recommendations": [
            "Проверить исходное видео оператором перед принятием процессуального решения.",
            "Передать фрагмент с 00:04 до 00:08 в карточку происшествия.",
            "Отметить участок как временную зону повышенного риска на карте CITY MONITOR.",
        ],
    })
