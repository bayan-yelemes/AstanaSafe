from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from ..database import Base


class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    accidents = relationship("Accident", back_populates="district")


class Accident(Base):
    __tablename__ = "accidents"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)

    type = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    weather = Column(String, nullable=True)

    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    description = Column(String, nullable=True)

    district = relationship("District", back_populates="accidents")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    phone = Column(String, unique=True, nullable=True, index=True)
    hashed_password = Column(String, nullable=True)
    google_sub = Column(String, unique=True, nullable=True, index=True)
    full_name = Column(String, nullable=True)
    role = Column(String, default="driver", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TrafficReport(Base):
    __tablename__ = "traffic_reports"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    road = Column(String, nullable=True)
    crossroad = Column(String, nullable=True)
    category = Column(String, nullable=False)
    type = Column(String, nullable=True)
    weather = Column(String, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    traffic_flow = Column(String, nullable=True)
    lanes_blocked = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    district = Column(String, nullable=True)
    user_name = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class RealAccident(Base):
    __tablename__ = "real_accidents"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, nullable=True, index=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    accident_date_raw = Column(String, nullable=True)
    year = Column(Integer, nullable=True)

    area_code = Column(String, nullable=True)
    accident_type = Column(String, nullable=True)
    road_condition = Column(String, nullable=True)

    district = Column(String, nullable=True)
    weather = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    description = Column(String, nullable=True)


class SosIncident(Base):
    __tablename__ = "sos_incidents"

    id = Column(Integer, primary_key=True, index=True)
    reporter_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accuracy_m = Column(Float, nullable=True)

    road = Column(String, nullable=True)
    crossroad = Column(String, nullable=True)
    district = Column(String, nullable=True)

    incident_type = Column(String, default="Road accident", nullable=False)
    urgency = Column(String, default="critical", nullable=False)
    status = Column(String, default="new", nullable=False, index=True)
    description = Column(String, nullable=True)

    reporter_name = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)
    reporter_email = Column(String, nullable=True)

    notification_log = Column(JSON, default=list, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
