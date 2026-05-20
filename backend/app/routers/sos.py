from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import ALGORITHM, SECRET_KEY
from ..database import get_db
from ..models import models
from ..schemas import schemas
from .auth import get_current_user

router = APIRouter(prefix="/sos", tags=["sos-incidents"])

ACTIVE_STATUSES = {"new", "accepted", "dispatched"}
ALLOWED_STATUSES = {"new", "accepted", "dispatched", "resolved", "cancelled"}

SERVICES = [
    ("police", "Police dispatch"),
    ("ambulance", "Ambulance dispatch"),
    ("road_service", "Road service"),
    ("city_dispatch", "City dispatcher"),
]


@dataclass(frozen=True)
class SosCallUser:
    id: int
    role: str
    full_name: str | None
    email: str | None
    phone: str | None


class SosCallConnectionManager:
    def __init__(self):
        self.connections: dict[int, set[WebSocket]] = {}
        self.users: dict[int, SosCallUser] = {}
        self.call_sessions: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user: models.User):
        await websocket.accept()
        self.connections.setdefault(user.id, set()).add(websocket)
        self.users[user.id] = SosCallUser(
            id=user.id,
            role=user.role,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
        )

    def disconnect(self, websocket: WebSocket, user_id: int):
        sockets = self.connections.get(user_id)
        if not sockets:
            return

        sockets.discard(websocket)
        if not sockets:
            self.connections.pop(user_id, None)
            self.users.pop(user_id, None)

    async def send_to_socket(self, websocket: WebSocket, payload: dict):
        await websocket.send_json(payload)

    async def send_to_user(self, user_id: int, payload: dict) -> int:
        sockets = list(self.connections.get(user_id, set()))
        delivered = 0

        for websocket in sockets:
            try:
                await websocket.send_json(payload)
                delivered += 1
            except RuntimeError:
                self.disconnect(websocket, user_id)

        return delivered

    def find_reporter_user_ids(self, incident: models.SosIncident) -> set[int]:
        user_ids: set[int] = set()

        if incident.reporter_user_id:
            user_ids.add(incident.reporter_user_id)

        incident_email = (incident.reporter_email or "").strip().lower()
        incident_phone = normalize_phone(incident.reporter_phone)

        for user in self.users.values():
            if incident_email and (user.email or "").strip().lower() == incident_email:
                user_ids.add(user.id)
            if incident_phone and normalize_phone(user.phone) == incident_phone:
                user_ids.add(user.id)

        return user_ids

    async def start_call(
        self,
        *,
        websocket: WebSocket,
        current_user: models.User,
        incident: models.SosIncident,
        call_id: str,
    ):
        driver_user_ids = self.find_reporter_user_ids(incident)
        online_driver_ids = [
            user_id for user_id in driver_user_ids if self.connections.get(user_id)
        ]

        if not online_driver_ids:
            await self.send_to_socket(
                websocket,
                {
                    "type": "call-unavailable",
                    "callId": call_id,
                    "incidentId": incident.id,
                    "message": "Driver is not online on the site.",
                },
            )
            return

        self.call_sessions[call_id] = {
            "incident_id": incident.id,
            "dispatcher_user_id": current_user.id,
            "driver_user_ids": set(online_driver_ids),
            "started_at": datetime.utcnow().isoformat(),
        }

        incoming_payload = {
            "type": "incoming-call",
            "callId": call_id,
            "incidentId": incident.id,
            "from": serialize_call_user(current_user),
            "incident": serialize_call_incident(incident),
        }

        for user_id in online_driver_ids:
            await self.send_to_user(user_id, incoming_payload)

        await self.send_to_socket(
            websocket,
            {
                "type": "call-ringing",
                "callId": call_id,
                "incidentId": incident.id,
                "driverOnline": True,
            },
        )

    async def route_to_peer(self, call_id: str, sender: models.User, payload: dict):
        session = self.call_sessions.get(call_id)
        if not session:
            return

        outgoing = dict(payload)
        outgoing["from"] = serialize_call_user(sender)

        if sender.id == session.get("dispatcher_user_id"):
            for user_id in session.get("driver_user_ids", set()):
                await self.send_to_user(user_id, outgoing)
            return

        dispatcher_user_id = session.get("dispatcher_user_id")
        if dispatcher_user_id:
            await self.send_to_user(dispatcher_user_id, outgoing)

    def close_call(self, call_id: str):
        self.call_sessions.pop(call_id, None)


call_manager = SosCallConnectionManager()


def normalize_phone(value: str | None) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def serialize_call_user(user: models.User | SosCallUser) -> dict:
    return {
        "id": user.id,
        "role": user.role,
        "name": user.full_name or "AstanaSafe user",
        "email": user.email,
        "phone": user.phone,
    }


def serialize_call_incident(incident: models.SosIncident) -> dict:
    return {
        "id": incident.id,
        "ticket": f"SOS-AST-{incident.id:04d}",
        "road": incident.road,
        "crossroad": incident.crossroad,
        "district": incident.district,
        "lat": incident.lat,
        "lng": incident.lng,
        "status": incident.status,
    }


def get_user_from_ws_token(token: str | None, db: Session) -> models.User | None:
    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        return None

    if not user_id:
        return None

    return db.query(models.User).filter(models.User.id == int(user_id)).first()


def build_notification_log():
    created = datetime.utcnow().isoformat()

    return [
        {
            "service": service,
            "label": label,
            "status": "sent",
            "sent_at": created,
            "simulation": True,
        }
        for service, label in SERVICES
    ]


@router.post("/incidents", response_model=schemas.SosIncidentOut)
def create_sos_incident(
    payload: schemas.SosIncidentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    incident = models.SosIncident(
        reporter_user_id=current_user.id,
        lat=payload.lat,
        lng=payload.lng,
        accuracy_m=payload.accuracy_m,
        road=payload.road,
        crossroad=payload.crossroad,
        district=payload.district,
        incident_type=payload.incident_type,
        urgency=payload.urgency,
        status="new",
        description=payload.description,
        reporter_name=current_user.full_name or payload.reporter_name,
        reporter_phone=current_user.phone or payload.reporter_phone,
        reporter_email=current_user.email or payload.reporter_email,
        notification_log=build_notification_log(),
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.websocket("/calls/ws")
async def sos_call_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    current_user = get_user_from_ws_token(token, db)
    if not current_user:
        await websocket.close(code=1008)
        return

    await call_manager.connect(websocket, current_user)

    try:
        while True:
            payload = await websocket.receive_json()
            message_type = str(payload.get("type") or "")
            call_id = str(payload.get("callId") or payload.get("call_id") or "")

            if message_type == "call-driver":
                if current_user.role not in {"dispatcher", "admin"}:
                    await call_manager.send_to_socket(
                        websocket,
                        {
                            "type": "call-error",
                            "message": "Dispatcher role required.",
                        },
                    )
                    continue

                incident_id = payload.get("incidentId") or payload.get("incident_id")
                incident = (
                    db.query(models.SosIncident)
                    .filter(models.SosIncident.id == incident_id)
                    .first()
                )

                if not incident:
                    await call_manager.send_to_socket(
                        websocket,
                        {
                            "type": "call-error",
                            "message": "SOS incident not found.",
                        },
                    )
                    continue

                await call_manager.start_call(
                    websocket=websocket,
                    current_user=current_user,
                    incident=incident,
                    call_id=call_id or uuid4().hex,
                )
                continue

            if not call_id:
                await call_manager.send_to_socket(
                    websocket,
                    {
                        "type": "call-error",
                        "message": "Call id is required.",
                    },
                )
                continue

            if message_type in {
                "call-accepted",
                "call-declined",
                "call-ended",
                "webrtc-offer",
                "webrtc-answer",
                "ice-candidate",
            }:
                await call_manager.route_to_peer(call_id, current_user, payload)

                if message_type in {"call-ended", "call-declined"}:
                    call_manager.close_call(call_id)

    except WebSocketDisconnect:
        pass
    finally:
        call_manager.disconnect(websocket, current_user.id)


@router.get("/incidents", response_model=list[schemas.SosIncidentOut])
def get_sos_incidents(
    active_only: bool = Query(False),
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    query = db.query(models.SosIncident)

    if active_only:
        query = query.filter(models.SosIncident.status.in_(ACTIVE_STATUSES))

    if status:
        normalized_status = status.strip().lower()
        if normalized_status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        query = query.filter(models.SosIncident.status == normalized_status)

    return (
        query.order_by(models.SosIncident.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/incidents/{incident_id}", response_model=schemas.SosIncidentOut)
def get_sos_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    incident = (
        db.query(models.SosIncident)
        .filter(models.SosIncident.id == incident_id)
        .first()
    )

    if not incident:
        raise HTTPException(status_code=404, detail="SOS incident not found")

    return incident


@router.patch("/incidents/{incident_id}/status", response_model=schemas.SosIncidentOut)
def update_sos_incident_status(
    incident_id: int,
    payload: schemas.SosIncidentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in {"dispatcher", "admin"}:
        raise HTTPException(status_code=403, detail="Dispatcher role required")

    normalized_status = payload.status.strip().lower()

    if normalized_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    incident = (
        db.query(models.SosIncident)
        .filter(models.SosIncident.id == incident_id)
        .first()
    )

    if not incident:
        raise HTTPException(status_code=404, detail="SOS incident not found")

    incident.status = normalized_status
    incident.updated_at = datetime.utcnow()

    log = list(incident.notification_log or [])
    log.append(
        {
            "service": "dispatcher",
            "label": "Dispatcher status update",
            "status": normalized_status,
            "sent_at": incident.updated_at.isoformat(),
            "simulation": True,
        }
    )
    incident.notification_log = log

    db.commit()
    db.refresh(incident)
    return incident
