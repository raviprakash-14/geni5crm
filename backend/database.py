
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing from .env")


class Base(DeclarativeBase):
    pass


engine_options = {"pool_pre_ping": True}

if os.getenv("VERCEL") == "1":
    # Keep each serverless instance's connection footprint small. Supabase's
    # transaction pooler requires psycopg's automatic prepared statements off.
    engine_options.update(
        pool_size=1,
        max_overflow=0,
        connect_args={"prepare_threshold": None},
    )

engine = create_engine(DATABASE_URL, **engine_options)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)
