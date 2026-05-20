import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import engine
from .models import models
from .routers import (
    accidents,
    auth,
    real_accidents,
    risk,
    roadvision,
    roads,
    sos,
    traffic_reports,
)
from .routers.ai import router as ai_router

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

LAN_CORS_ORIGIN_REGEX = (
    r"https?://("
    r"localhost|127\.0\.0\.1|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
    r"):(5173|4173)"
)


def get_cors_origins() -> list[str]:
    origins = list(DEFAULT_CORS_ORIGINS)

    for origin in os.getenv("CORS_ORIGINS", "").split(","):
        cleaned_origin = origin.strip()
        if cleaned_origin and cleaned_origin not in origins:
            origins.append(cleaned_origin)

    return origins


def create_app() -> FastAPI:
    models.Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'driver' NOT NULL"
            )
        )
        connection.execute(
            text(
                "UPDATE users SET role = 'driver' "
                "WHERE role IS NULL OR role NOT IN ('driver', 'dispatcher', 'admin')"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE traffic_reports "
                "ADD COLUMN IF NOT EXISTS duration_minutes INTEGER"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE traffic_reports "
                "ADD COLUMN IF NOT EXISTS traffic_flow VARCHAR"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE traffic_reports "
                "ADD COLUMN IF NOT EXISTS lanes_blocked VARCHAR"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE traffic_reports "
                "ADD COLUMN IF NOT EXISTS notes VARCHAR"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE sos_incidents "
                "ADD COLUMN IF NOT EXISTS reporter_user_id INTEGER"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_sos_incidents_reporter_user_id "
                "ON sos_incidents (reporter_user_id)"
            )
        )

    app = FastAPI(title="AstanaSafe API", version="1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_origin_regex=LAN_CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(accidents.router, prefix="/api/accidents", tags=["accidents"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(roads.router, prefix="/api", tags=["roads"])
    app.include_router(traffic_reports.router, prefix="/api", tags=["traffic-reports"])
    app.include_router(real_accidents.router, prefix="/api", tags=["real-accidents"])
    app.include_router(risk.router, prefix="/api")
    app.include_router(sos.router, prefix="/api")
    app.include_router(roadvision.router, prefix="/api")
    app.include_router(ai_router, prefix="/api")

    @app.get("/health")
    def health():
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok"}

    @app.get("/")
    def root():
        return {"message": "AstanaSafe API is running"}

    return app


app = create_app()
