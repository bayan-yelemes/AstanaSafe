from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class DistrictOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class AccidentOut(BaseModel):
    id: int
    latitude: float
    longitude: float
    date: datetime
    type: str | None = None
    severity: str | None = None
    weather: str | None = None
    description: str | None = None
    district: DistrictOut | None = None

    class Config:
        from_attributes = True


class TrafficReportCreate(BaseModel):
    lat: float
    lng: float
    road: str | None = None
    crossroad: str | None = None
    category: str
    type: str | None = None
    weather: str | None = None
    duration_minutes: int | None = None
    traffic_flow: str | None = None
    lanes_blocked: str | None = None
    notes: str | None = None
    district: str | None = None
    user_name: str | None = None
    report_date: str | None = None


class TrafficReportOut(BaseModel):
    id: int
    lat: float
    lng: float
    road: str | None = None
    crossroad: str | None = None
    category: str
    type: str | None = None
    weather: str | None = None
    duration_minutes: int | None = None
    traffic_flow: str | None = None
    lanes_blocked: str | None = None
    notes: str | None = None
    district: str | None = None
    user_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    password: str
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    password: str


class GoogleLoginIn(BaseModel):
    credential: str


class PasswordResetRequest(BaseModel):
    email: str | None = None
    contact: str | None = None


class PasswordResetConfirm(BaseModel):
    token: str
    password: str = Field(min_length=6)


class MessageOut(BaseModel):
    message: str
    reset_url: str | None = None


class UserOut(BaseModel):
    id: int
    email: EmailStr | None = None
    phone: str | None = None
    full_name: str | None = None
    role: str = "driver"

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    full_name: str | None = None
    role: str | None = None
    password: str | None = None


class UserSelfUpdate(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    full_name: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RealAccidentOut(BaseModel):
    id: int
    source_id: str | None = None
    latitude: float
    longitude: float
    accident_date_raw: str | None = None
    year: int | None = None
    area_code: str | None = None
    accident_type: str | None = None
    road_condition: str | None = None
    district: str | None = None
    weather: str | None = None
    severity: str | None = None
    description: str | None = None

    class Config:
        from_attributes = True


class SosIncidentCreate(BaseModel):
    lat: float
    lng: float
    accuracy_m: float | None = None
    road: str | None = None
    crossroad: str | None = None
    district: str | None = None
    incident_type: str = "Road accident"
    urgency: str = "critical"
    description: str | None = None
    reporter_name: str | None = None
    reporter_phone: str | None = None
    reporter_email: str | None = None


class SosIncidentStatusUpdate(BaseModel):
    status: str


class SosIncidentOut(BaseModel):
    id: int
    reporter_user_id: int | None = None
    lat: float
    lng: float
    accuracy_m: float | None = None
    road: str | None = None
    crossroad: str | None = None
    district: str | None = None
    incident_type: str
    urgency: str
    status: str
    description: str | None = None
    reporter_name: str | None = None
    reporter_phone: str | None = None
    reporter_email: str | None = None
    notification_log: list[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
