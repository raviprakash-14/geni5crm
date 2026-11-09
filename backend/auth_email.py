
import hashlib
import os
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from auth import hash_password
from models import AuthToken, User

load_dotenv(Path(__file__).resolve().parent / ".env")

FRONTEND_BASE_URL = os.getenv(
    "FRONTEND_BASE_URL", "http://localhost:3000"
).rstrip("/")

INVITATION_EXPIRE_HOURS = int(
    os.getenv("INVITATION_EXPIRE_HOURS", "24")
)
PASSWORD_RESET_EXPIRE_MINUTES = int(
    os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30")
)


def send_email(to_email: str, subject: str, body: str) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "465"))
    username = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]
    sender = os.getenv("SMTP_FROM_EMAIL", username)
    sender_name = os.getenv("SMTP_FROM_NAME", "Geni5 CRM")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{sender_name} <{sender}>"
    message["To"] = to_email
    message.set_content(body)

    context = ssl.create_default_context()

    if port == 465:
        with smtplib.SMTP_SSL(
            host, port, context=context, timeout=20
        ) as server:
            server.login(username, password)
            server.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(username, password)
            server.send_message(message)


def create_auth_token(
    db: Session,
    user: User,
    purpose: str,
) -> str:
    if purpose not in ("invitation", "password_reset"):
        raise ValueError("Unsupported authentication token purpose")

    # Invalidate any earlier unused tokens for the same purpose.
    db.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
    )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    if purpose == "invitation":
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=INVITATION_EXPIRE_HOURS
        )
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=PASSWORD_RESET_EXPIRE_MINUTES
        )

    db.add(
        AuthToken(
            token_hash=token_hash,
            user_id=user.id,
            purpose=purpose,
            expires_at=expires_at,
        )
    )
    db.flush()

    return raw_token


def build_auth_link(purpose: str, raw_token: str) -> str:
    if purpose == "invitation":
        path = "/activate-account"
    elif purpose == "password_reset":
        path = "/reset-password"
    else:
        raise ValueError("Unsupported authentication token purpose")

    query = urlencode({"token": raw_token})
    return f"{FRONTEND_BASE_URL}{path}?{query}"


def send_auth_email(
    to_email: str,
    full_name: str,
    purpose: str,
    raw_token: str,
) -> None:
    link = build_auth_link(purpose, raw_token)

    if purpose == "invitation":
        subject = "Activate your Geni5 CRM account"
        action = "activate your account and choose a password"
        expiry = f"{INVITATION_EXPIRE_HOURS} hours"
    else:
        subject = "Reset your Geni5 CRM password"
        action = "choose a new password"
        expiry = f"{PASSWORD_RESET_EXPIRE_MINUTES} minutes"

    body = (
        f"Hello {full_name},\n\n"
        f"Use the following link to {action}:\n\n"
        f"{link}\n\n"
        f"This link expires in {expiry} and can only be used once.\n"
        "If you did not request this, you can ignore this email.\n\n"
        "Geni5 CRM"
    )

    send_email(to_email, subject, body)


def redeem_auth_token(
    db: Session,
    raw_token: str,
    purpose: str,
) -> tuple[AuthToken, User]:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    token_record = db.scalar(
        select(AuthToken)
        .where(
            AuthToken.token_hash == token_hash,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
        .with_for_update()
    )

    now = datetime.now(timezone.utc)

    if token_record is None:
        raise HTTPException(
            status_code=400,
            detail="This link is invalid or has already been used.",
        )

    expiry = token_record.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if expiry <= now:
        raise HTTPException(
            status_code=400,
            detail="This link has expired. Request a new one.",
        )

    user = db.get(User, token_record.user_id)

    if user is None:
        raise HTTPException(
            status_code=400,
            detail="This link is no longer valid.",
        )

    token_record.used_at = now
    return token_record, user


def set_user_password(user: User, password: str) -> None:
    user.hashed_password = hash_password(password)
