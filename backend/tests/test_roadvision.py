import asyncio
from hashlib import sha1

import app.services.roadvision as roadvision_service
from app.routers import roadvision as roadvision_router
from app.services.roadvision import (
    build_roadvision_analysis,
    _attach_gemini_unavailable,
    _build_gemini_prompt,
    _normalize_gemini_analysis,
)


def test_roadvision_analysis_has_forensics_shape():
    result = build_roadvision_analysis(
        filename="dashcam-777ABA01-118KZA01.mp4",
        file_size=4_200_000,
        scenario="left_turn_conflict",
        location_name="Кабанбай батыра / Сыганак",
        lat=51.1239,
        lng=71.4302,
    )

    assert result["analysis_id"].startswith("rv-")
    assert result["status"] == "requires_human_review"
    assert len(result["participants"]) == 2
    assert result["participants"][0]["plate"] == "777ABA01"
    assert result["participants"][1]["plate"] == "118KZA01"
    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"
    assert result["traffic_impact"]["jam_probability"] >= 60


def test_prepared_roadvision_video_hash_returns_frame_report(monkeypatch):
    video_bytes = b"prepared roadvision sample"
    monkeypatch.setattr(
        roadvision_service,
        "PREPARED_ROADVISION_VIDEO_SHA1",
        sha1(video_bytes).hexdigest(),
    )

    result = roadvision_service.find_prepared_roadvision_analysis(
        video_bytes=video_bytes,
        filename="1000081819.mp4",
        content_type="video/mp4",
        location_name="Кабанбай батыра / Сыганак",
        lat=51.1239,
        lng=71.4302,
    )

    assert result is not None
    assert result["source"] == "roadvision_prepared"
    assert result["analysis_quality"]["timeline_source"] == "prepared_video_frames"
    assert result["event_confirmed"] is True
    assert len(result["participants"]) == 2
    assert result["detected_objects"]["vehicles"] == 2
    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"
    assert result["scenario"]["impact_type"] == "side_impact"
    assert "белый седан" in result["forensics"]["probable_cause"]
    assert "перестроился направо" in result["forensics"]["probable_cause"]


def test_prepared_named_video_template_returns_video1_report(monkeypatch):
    video_bytes = b"prepared named video1 sample"
    template = dict(roadvision_service.PREPARED_ROADVISION_VIDEO_REPORTS["video1"])
    template["sha1"] = sha1(video_bytes).hexdigest()
    monkeypatch.setitem(
        roadvision_service.PREPARED_ROADVISION_VIDEO_REPORTS,
        "video1",
        template,
    )

    result = roadvision_service.find_prepared_roadvision_analysis(
        video_bytes=video_bytes,
        filename="video1.mov",
        content_type="video/quicktime",
        location_name="Кабанбай батыра / Сыганак",
        lat=51.1239,
        lng=71.4302,
    )

    assert result is not None
    assert result["source"] == "roadvision_prepared"
    assert result["analysis_quality"]["prepared_video_key"] == "video1"
    assert result["scenario"]["title"] == "Столкновение на перекрестке с белым служебным фургоном"
    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"
    assert result["timeline"][2]["title"] == "Момент столкновения"


def test_prepared_named_video2_uses_rear_end_lane_change_report(monkeypatch):
    video_bytes = b"prepared named video2 sample"
    template = dict(roadvision_service.PREPARED_ROADVISION_VIDEO_REPORTS["video2"])
    template["sha1"] = sha1(video_bytes).hexdigest()
    monkeypatch.setitem(
        roadvision_service.PREPARED_ROADVISION_VIDEO_REPORTS,
        "video2",
        template,
    )

    result = roadvision_service.find_prepared_roadvision_analysis(
        video_bytes=video_bytes,
        filename="video2.mov",
        content_type="video/quicktime",
        location_name="Кабанбай батыра / Сыганак",
        lat=51.1239,
        lng=71.4302,
    )

    assert result is not None
    assert result["analysis_quality"]["prepared_video_key"] == "video2"
    assert result["scenario"]["impact_type"] == "rear_end"
    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"
    assert "черный автомобиль" in result["forensics"]["probable_cause"]
    assert "заднюю часть серого автомобиля" in result["forensics"]["probable_cause"]
    assert "регистратор не является участником дтп" in result["analysis_quality"]["warnings"][1].lower()
    assert "мотоцикл" not in result["forensics"]["probable_cause"].lower()


def test_prepared_named_video4_marks_contact_as_unconfirmed(monkeypatch):
    video_bytes = b"prepared named video4 sample"
    template = dict(roadvision_service.PREPARED_ROADVISION_VIDEO_REPORTS["video4"])
    template["sha1"] = sha1(video_bytes).hexdigest()
    monkeypatch.setitem(
        roadvision_service.PREPARED_ROADVISION_VIDEO_REPORTS,
        "video4",
        template,
    )

    result = roadvision_service.find_prepared_roadvision_analysis(
        video_bytes=video_bytes,
        filename="video4.MOV",
        content_type="video/quicktime",
        location_name="Кабанбай батыра / Сыганак",
        lat=51.1239,
        lng=71.4302,
    )

    assert result is not None
    assert result["analysis_quality"]["prepared_video_key"] == "video4"
    assert result["event_confirmed"] is False
    assert "не подтвержден" in result["uncertainty_reason"]
    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle A"


def test_roadvision_router_returns_prepared_report_for_demo_hash(monkeypatch):
    class Upload:
        filename = "1000081819.mp4"
        content_type = "video/mp4"

        async def read(self):
            return b"prepared roadvision sample"

    monkeypatch.setattr(
        roadvision_service,
        "PREPARED_ROADVISION_VIDEO_SHA1",
        sha1(b"prepared roadvision sample").hexdigest(),
    )

    result = asyncio.run(
        roadvision_router.analyze_roadvision_video(
            video=Upload(),
            scenario="unknown",
            location_name="Кабанбай батыра / Сыганак",
            lat=51.1239,
            lng=71.4302,
        )
    )

    assert result["source"] == "roadvision_prepared"
    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"
    assert "белый седан" in result["forensics"]["probable_cause"]
    assert "тип события не задан" not in result["forensics"]["probable_cause"]


def test_roadvision_router_returns_template_by_default(monkeypatch):
    class Upload:
        filename = "dashcam.mp4"
        content_type = "video/mp4"

        async def read(self):
            return b"new roadvision sample"

    result = asyncio.run(
        roadvision_router.analyze_roadvision_video(
            video=Upload(),
            scenario="unknown",
            location_name="Кабанбай батыра / Сыганак",
            lat=51.1239,
            lng=71.4302,
        )
    )

    assert result["source"] == "roadvision_mvp"
    assert result["analysis_quality"]["timeline_source"] == "scenario_template"


def test_roadvision_router_ignores_requested_gemini_engine():
    class Upload:
        filename = "dashcam.mp4"
        content_type = "video/mp4"

        async def read(self):
            return b"new roadvision sample"

    result = asyncio.run(
        roadvision_router.analyze_roadvision_video(
            video=Upload(),
            scenario="unknown",
            location_name="Кабанбай батыра / Сыганак",
            lat=51.1239,
            lng=71.4302,
            engine="gemini",
        )
    )

    assert result["source"] == "roadvision_mvp"
    assert result["analysis_quality"]["timeline_source"] == "scenario_template"


def test_roadvision_router_returns_kazakh_template_warnings():
    class Upload:
        filename = "dashcam.mp4"
        content_type = "video/mp4"

        async def read(self):
            return b"new roadvision sample"

    result = asyncio.run(
        roadvision_router.analyze_roadvision_video(
            video=Upload(),
            scenario="unknown",
            location_name="Кабанбай батыра / Сыганак",
            lat=51.1239,
            lng=71.4302,
            language="kz",
        )
    )

    assert result["source"] == "roadvision_mvp"
    assert result["analysis_quality"]["warnings"] == [
        "Хронология таңдалған сценарий бойынша құрылды және оператордың тексеруін қажет етеді.",
        "MVP режимінде мемлекеттік нөмірді сенімді анықтау мүмкін болмады; қолмен растау қажет.",
    ]


def test_gemini_prompt_builds_with_dashcam_context():
    prompt = _build_gemini_prompt("left_turn_conflict", "Кабанбай батыра / Сыганак")

    assert '"camera_context"' in prompt
    assert "Vehicle A is ALWAYS the camera/ego vehicle" in prompt


def test_roadvision_unknown_scenario_stays_generic():
    result = build_roadvision_analysis(
        filename="video.mp4",
        file_size=1,
        scenario="unknown",
    )

    assert result["scenario"]["key"] == "unknown"
    assert result["scenario"]["title"] == "Событие ДТП определяется по видео"
    assert result["location"]["lat"] == 51.1239
    assert result["participants"][0]["plate"] == "Требуется проверка"
    assert result["analysis_quality"]["plate_recognition"] == "needs_manual_review"


def test_roadvision_response_hides_2d_overlay_geometry():
    result = build_roadvision_analysis(
        filename="video.mp4",
        file_size=1,
        scenario="unknown",
    )

    assert result["participants"]
    assert "bbox_hint" not in result["participants"][0]
    assert "trajectory" not in result["participants"][0]


def test_gemini_unavailable_annotation_marks_quota():
    fallback = build_roadvision_analysis(
        filename="video.mp4",
        file_size=1,
        scenario="unknown",
    )

    result = _attach_gemini_unavailable(
        fallback,
        RuntimeError("429 RESOURCE_EXHAUSTED quota exceeded for gemini-2.5-flash"),
    )

    assert result["source"] == "roadvision_mvp"
    assert result["analysis_quality"]["gemini_status"] == "quota_exceeded"
    assert "Gemini API" in result["analysis_quality"]["gemini_message"]
    assert result["analysis_quality"]["warnings"][0] == result["analysis_quality"]["gemini_message"]


def test_unconfirmed_gemini_event_is_capped_for_review():
    fallback = build_roadvision_analysis(
        filename="dashcam.mp4",
        file_size=2_000_000,
        scenario="unknown",
    )
    raw = {
        "event_confirmed": False,
        "uncertainty_reason": "контакт между участниками не виден",
        "confidence": 92,
        "risk_score": 88,
        "impact_type": "side_impact",
        "participants": [{"id": "A", "label": "Vehicle A"}],
        "timeline": [
            {
                "time": "00:04",
                "observed_at_sec": 4,
                "title": "Замедление",
                "detail": "Видно только замедление потока без контакта.",
                "visual_evidence": "нет перекрытия или удара",
                "level": "warning",
            }
        ],
        "participant_with_violation_signs": "Vehicle B",
    }

    result = _normalize_gemini_analysis(
        raw,
        fallback=fallback,
        filename="dashcam.mp4",
        content_type="video/mp4",
        file_size=2_000_000,
        scenario="unknown",
        location_name=None,
        lat=None,
        lng=None,
    )

    assert result["confidence"] <= 65
    assert result["risk_score"] <= 55
    assert result["scenario"]["impact_type"] == "unknown"
    assert result["forensics"]["participant_with_violation_signs"] == "Not assigned"
    assert "bbox_hint" not in result["participants"][0]


def test_roadvision_timeline_changes_by_scenario():
    result = build_roadvision_analysis(
        filename="rear-end.mp4",
        file_size=1,
        scenario="rear_end",
    )

    assert result["scenario"]["title"] == "Попутное столкновение"
    assert result["timeline"][1]["title"] == "Снижение скорости"


def test_gemini_normalization_repairs_placeholder_numbers():
    fallback = build_roadvision_analysis(
        filename="dashcam.mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
    )
    raw = {
        "confidence": 0,
        "risk_score": 8,
        "vehicles_count": 2,
        "participants": [
            {"id": "A", "label": "Vehicle A"},
            {"id": "B", "label": "Vehicle B"},
            {"id": "C", "label": "Vehicle C"},
        ],
        "timeline": [
            {
                "time": "00:29",
                "title": "Impact",
                "detail": "Visible dangerous maneuver",
                "level": "info",
            }
        ],
        "participant_with_violation_signs": "Vehicle B",
    }

    result = _normalize_gemini_analysis(
        raw,
        fallback=fallback,
        filename="dashcam.mp4",
        content_type="video/mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
        location_name=None,
        lat=None,
        lng=None,
    )

    assert result["confidence"] == 48
    assert result["risk_score"] == 58
    assert result["detected_objects"]["vehicles"] == 3
    assert result["timeline"][0]["level"] == "danger"


def test_gemini_timeline_is_sorted_by_observed_seconds():
    fallback = build_roadvision_analysis(
        filename="dashcam.mp4",
        file_size=2_000_000,
        scenario="rear_end",
    )
    raw = {
        "confidence": 62,
        "risk_score": 71,
        "vehicles_count": 2,
        "participants": [
            {"id": "A", "label": "Vehicle A"},
            {"id": "B", "label": "Vehicle B"},
        ],
        "timeline": [
            {
                "time": "00:06",
                "observed_at_sec": 6,
                "title": "Контакт",
                "detail": "Задний автомобиль достигает передний автомобиль.",
                "visual_evidence": "видно перекрытие контуров автомобилей",
                "level": "danger",
            },
            {
                "time": "00:02",
                "observed_at_sec": 2,
                "title": "Сокращение дистанции",
                "detail": "Дистанция между автомобилями уменьшается.",
                "visual_evidence": "Vehicle B приближается в той же полосе",
                "level": "warning",
            },
        ],
    }

    result = _normalize_gemini_analysis(
        raw,
        fallback=fallback,
        filename="dashcam.mp4",
        content_type="video/mp4",
        file_size=2_000_000,
        scenario="rear_end",
        location_name=None,
        lat=None,
        lng=None,
    )

    assert result["analysis_quality"]["timeline_source"] == "gemini_video_frames"
    assert [item["time"] for item in result["timeline"]] == ["00:02", "00:06"]
    assert result["timeline"][0]["visual_evidence"] == "Vehicle B приближается в той же полосе"


def test_gemini_template_timeline_is_marked_for_manual_review():
    fallback = build_roadvision_analysis(
        filename="dashcam.mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
    )
    raw = {
        "confidence": 60,
        "risk_score": 70,
        "vehicles_count": 2,
        "participants": [
            {"id": "A", "label": "Vehicle A"},
            {"id": "B", "label": "Vehicle B"},
        ],
        "timeline": fallback["timeline"],
    }

    result = _normalize_gemini_analysis(
        raw,
        fallback=fallback,
        filename="dashcam.mp4",
        content_type="video/mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
        location_name=None,
        lat=None,
        lng=None,
    )

    assert result["analysis_quality"]["timeline_source"] == "scenario_template_after_gemini"
    assert result["timeline"] == fallback["timeline"]


def test_dashcam_role_inversion_is_corrected():
    fallback = build_roadvision_analysis(
        filename="dashcam.mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
    )
    raw = {
        "confidence": 75,
        "risk_score": 80,
        "vehicles_count": 2,
        "participants": [
            {
                "id": "A",
                "label": "Белый седан (Vehicle A)",
                "movement": "поворачивает налево в полосу движения",
                "role": "видимый маневрирующий автомобиль",
            },
            {
                "id": "B",
                "label": "Серый автомобиль (Vehicle B)",
                "movement": "приближается прямо",
                "role": "автомобиль с видеорегистратором",
            },
        ],
        "timeline": [
            {
                "time": "00:04",
                "observed_at_sec": 4,
                "title": "Белый седан (Vehicle A) начинает маневр",
                "detail": "Vehicle A поворачивает перед Vehicle B.",
                "visual_evidence": "белый седан смещается в траекторию движения камеры",
                "level": "warning",
            }
        ],
        "probable_cause": "Vehicle A повернул перед Vehicle B",
        "participant_with_violation_signs": "Vehicle A",
    }

    result = _normalize_gemini_analysis(
        raw,
        fallback=fallback,
        filename="dashcam.mp4",
        content_type="video/mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
        location_name=None,
        lat=None,
        lng=None,
    )

    assert result["participants"][0]["id"] == "A"
    assert "регистратор" in result["participants"][0]["label"].lower()
    assert result["participants"][1]["id"] == "B"
    assert "Белый седан" in result["participants"][1]["label"]
    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"
    assert "Vehicle B" in result["timeline"][0]["title"]


def test_single_letter_violation_actor_is_normalized():
    fallback = build_roadvision_analysis(
        filename="dashcam.mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
    )
    raw = {
        "confidence": 70,
        "risk_score": 75,
        "vehicles_count": 2,
        "camera_context": {"is_dashcam": True},
        "participants": [
            {"id": "A", "label": "Vehicle A (регистратор)", "role": "автомобиль с видеорегистратором"},
            {"id": "B", "label": "Белый седан", "movement": "поворачивает в полосу Vehicle A"},
        ],
        "timeline": [
            {
                "time": "00:03",
                "title": "Маневр седана",
                "detail": "Vehicle B смещается в полосу Vehicle A.",
                "visual_evidence": "белый седан приближается к траектории камеры",
                "level": "warning",
            }
        ],
        "participant_with_violation_signs": "B",
    }

    result = _normalize_gemini_analysis(
        raw,
        fallback=fallback,
        filename="dashcam.mp4",
        content_type="video/mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
        location_name=None,
        lat=None,
        lng=None,
    )

    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"


def test_dashcam_left_turn_conflict_anchors_vehicle_b_even_when_model_is_cautious():
    fallback = build_roadvision_analysis(
        filename="dashcam.mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
    )
    raw = {
        "confidence": 70,
        "risk_score": 75,
        "vehicles_count": 2,
        "camera_context": {"is_dashcam": True, "primary_conflict_vehicle_id": "B"},
        "participants": [
            {"id": "A", "label": "Vehicle A (регистратор)", "role": "автомобиль с видеорегистратором", "movement": "движется прямо"},
            {"id": "B", "label": "Белый седан", "movement": "движется прямо"},
        ],
        "timeline": [
            {
                "time": "00:05",
                "title": "Сближение",
                "detail": "Белый седан находится перед траекторией камеры.",
                "visual_evidence": "видно белый седан в зоне движения Vehicle A",
                "level": "warning",
            }
        ],
        "participant_with_violation_signs": "Not assigned",
    }

    result = _normalize_gemini_analysis(
        raw,
        fallback=fallback,
        filename="dashcam.mp4",
        content_type="video/mp4",
        file_size=2_000_000,
        scenario="left_turn_conflict",
        location_name=None,
        lat=None,
        lng=None,
    )

    assert result["forensics"]["participant_with_violation_signs"] == "Vehicle B"
    assert "маневр" in result["participants"][1]["movement"]
    assert result["participants"][1]["violation_signs"]
