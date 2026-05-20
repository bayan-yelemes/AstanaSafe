import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from ..database import get_db
from ..models import models
from ..schemas import schemas
from ..config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    GOOGLE_CLIENT_ID,
    FRONTEND_URL,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
)
from ..services.email_service import send_password_reset_email

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")
ALLOWED_ROLES = {"driver", "dispatcher", "admin"}


def normalize_role(role: str | None) -> str:
    normalized = str(role or "driver").strip().lower()
    if normalized not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid user role")
    return normalized


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_password_reset_url(token: str) -> str:
    query = urlencode({"token": token})
    return f"{FRONTEND_URL.rstrip('/')}/reset-password?{query}"


def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    return current_user


def ensure_unique_contact(
    db: Session,
    user_id: int,
    email: str | None = None,
    phone: str | None = None,
):
    if email:
        existing_email = (
            db.query(models.User)
            .filter(models.User.email == email, models.User.id != user_id)
            .first()
        )
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    if phone:
        existing_phone = (
            db.query(models.User)
            .filter(models.User.phone == phone, models.User.id != user_id)
            .first()
        )
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone already registered")


@router.post("/register", response_model=schemas.TokenOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Provide email or phone")

    if payload.email:
        existing_email = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    if payload.phone:
        existing_phone = db.query(models.User).filter(models.User.phone == payload.phone).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone already registered")

    user = models.User(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        role="driver",
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/login", response_model=schemas.TokenOut)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Provide email or phone")

    user = None
    if payload.email:
        user = db.query(models.User).filter(models.User.email == payload.email).first()
    elif payload.phone:
        user = db.query(models.User).filter(models.User.phone == payload.phone).first()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserSelfUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    email = payload.email.strip() if payload.email else None
    phone = payload.phone.strip() if payload.phone else None

    if not email and not phone:
        raise HTTPException(status_code=400, detail="Provide email or phone")

    ensure_unique_contact(db, user_id=current_user.id, email=email, phone=phone)

    current_user.email = email
    current_user.phone = phone
    current_user.full_name = (
        payload.full_name.strip() if payload.full_name else None
    )

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=schemas.MessageOut)
def change_password(
    payload: schemas.PasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="Password changes are unavailable for this account",
        )

    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password has been updated successfully."}


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.post("/forgot-password", response_model=schemas.MessageOut)
def forgot_password(
    payload: schemas.PasswordResetRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()
    generic_message = "If that email exists, a password reset link has been sent."

    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == email)
        .first()
    )
    if not user or not user.email:
        return {"message": generic_message}

    now = datetime.utcnow()
    token = secrets.token_urlsafe(32)
    reset_token = models.PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(token),
        expires_at=now + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        created_at=now,
    )

    (
        db.query(models.PasswordResetToken)
        .filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.used_at.is_(None),
        )
        .update({"used_at": now}, synchronize_session=False)
    )
    db.add(reset_token)
    db.commit()

    try:
        send_password_reset_email(
            to_email=user.email,
            full_name=user.full_name,
            reset_url=build_password_reset_url(token),
            expires_minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
        )
    except Exception as exc:
        print(f"Failed to send password reset email to {user.email}: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Password reset email could not be sent",
        )

    return {"message": generic_message}


@router.post("/reset-password", response_model=schemas.MessageOut)
def reset_password(
    payload: schemas.PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    token_hash = hash_reset_token(payload.token)
    reset_token = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token_hash == token_hash)
        .first()
    )

    now = datetime.utcnow()
    if (
        not reset_token
        or reset_token.used_at is not None
        or reset_token.expires_at < now
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user = db.query(models.User).filter(models.User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user.hashed_password = hash_password(payload.password)
    reset_token.used_at = now
    (
        db.query(models.PasswordResetToken)
        .filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.id != reset_token.id,
            models.PasswordResetToken.used_at.is_(None),
        )
        .update({"used_at": now}, synchronize_session=False)
    )
    db.commit()

    return {"message": "Password has been updated successfully."}


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = payload.email.strip() if payload.email else None
    phone = payload.phone.strip() if payload.phone else None

    ensure_unique_contact(db, user_id=user.id, email=email, phone=phone)

    user.email = email
    user.phone = phone
    user.full_name = payload.full_name.strip() if payload.full_name else None

    if payload.role is not None:
        user.role = normalize_role(payload.role)

    if payload.password:
        user.hashed_password = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return user


@router.post("/google", response_model=schemas.TokenOut)
def google_login(payload: schemas.GoogleLoginIn, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google client ID is not configured")

    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_sub = idinfo["sub"]
    email = idinfo.get("email")
    name = idinfo.get("name")

    user = db.query(models.User).filter(models.User.google_sub == google_sub).first()

    if not user and email:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_sub = google_sub
            if not user.full_name:
                user.full_name = name
            db.commit()
            db.refresh(user)

    if not user:
        user = models.User(
            email=email,
            google_sub=google_sub,
            full_name=name,
            role="driver",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }
