from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..services.roadvision import (
    build_roadvision_analysis,
    find_prepared_roadvision_analysis,
)

router = APIRouter(prefix="/roadvision", tags=["roadvision"])

MAX_VIDEO_SIZE = 250 * 1024 * 1024


@router.post("/analyze")
async def analyze_roadvision_video(
    video: UploadFile = File(...),
    scenario: str = Form("left_turn_conflict"),
    location_name: str = Form("Кабанбай батыра / Сыганак"),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    engine: str = Form("template"),
    language: str = Form("ru"),
):
    content = await video.read()

    if len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Video is too large for MVP analysis. Use a file under 250 MB.",
        )

    filename = video.filename or "uploaded-video.mp4"
    content_type = video.content_type or "video/mp4"
    language_value = str(getattr(language, "default", language) or "ru")

    prepared_analysis = find_prepared_roadvision_analysis(
        video_bytes=content,
        filename=filename,
        content_type=content_type,
        location_name=location_name,
        lat=lat,
        lng=lng,
    )
    if prepared_analysis is not None:
        return prepared_analysis

    return build_roadvision_analysis(
        filename=filename,
        content_type=content_type,
        file_size=len(content),
        scenario=scenario,
        location_name=location_name,
        lat=lat,
        lng=lng,
        language=language_value,
    )
