
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import token

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET_KEY must be set to a strong secret in backend/.env"
    )

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)



def create_access_token(user_id: int, token_version: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "exp": expires_at,
        "ver": token_version,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        subject = payload.get("sub")

        if not subject:
            raise HTTPException(
                status_code=401,
                detail="Token is missing the user ID",
            )

        user_id = int(subject)

    except jwt.ExpiredSignatureError:
        print("JWT DEBUG: Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")

    except jwt.InvalidTokenError as exc:
        print(f"JWT DEBUG: Invalid token: {type(exc).__name__}")
        raise HTTPException(status_code=401, detail="Invalid token")

    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

    
    user = db.get(User, user_id)

    if user is None:
      print(f"JWT DEBUG: User ID {user_id} not found")
      raise HTTPException(status_code=401, detail="User not found")

    if not user.is_active:
      raise HTTPException(status_code=401, detail="User account is inactive")

    token_version = payload.get("ver")

    if token_version != user.token_version:
      raise HTTPException(
        status_code=401,
        detail="Session expired. Please sign in again.",
    )

    return user

