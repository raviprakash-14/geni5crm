
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select

from auth import hash_password
from database import Base, SessionLocal, engine
from models import User

# Ensure all registered models' tables exist.
Base.metadata.create_all(bind=engine)

email_validator = TypeAdapter(EmailStr)


def main():
    raw_email = input("Admin email: ").strip()

    try:
        email = str(email_validator.validate_python(raw_email)).lower()
    except ValidationError:
        print("Please enter a valid email address.")
        return

    full_name = input("Admin full name: ").strip()

    if not full_name or len(full_name) > 150:
        print("Full name is required and must be at most 150 characters.")
        return

    password = getpass("Admin password: ")
    confirm_password = getpass("Confirm password: ")

    if not 12 <= len(password) <= 128:
        print("Password must be between 12 and 128 characters.")
        return

    if password != confirm_password:
        print("Passwords do not match.")
        return

    with SessionLocal() as db:
        existing_admin = db.scalar(
            select(User.id).where(User.role == "admin").limit(1)
        )

        if existing_admin is not None:
            print("An administrator already exists. Setup cancelled.")
            return

        existing_user = db.scalar(
            select(User.id).where(User.email == email)
        )

        if existing_user is not None:
            print("A user with that email already exists.")
            return

        admin = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True,
        )

        db.add(admin)
        db.commit()

    print("Admin account created successfully.")


if __name__ == "__main__":
    main()
