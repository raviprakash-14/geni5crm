import secrets
from collections.abc import Generator
from datetime import datetime, timezone
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from models import Lead, FollowUp, Activity, User, Message
from auth import hash_password
from auth import get_current_user
from activity_schemas import ActivityCreate, ActivityResponse
from message_schemas import MessageCreate, MessageResponse
from client_schemas import ClientAssignment
from database import Base, SessionLocal, engine
from auth_email import create_auth_token, send_auth_email, redeem_auth_token, set_user_password, send_email
from auth_token_schemas import (
    ActivateAccountRequest,
    PasswordResetRequest,
    PasswordResetConfirmRequest,
)
from auth import (
    create_access_token,
    get_current_user,
    verify_password,
)
from auth_schemas import LoginRequest, TokenResponse, UserResponse, AdminUserCreate, AdminUserUpdate, AdminUserResponse
from followup_schemas import (
    FollowUpCreate,
    FollowUpUpdate,
    FollowUpResponse,
)
from schemas import LeadCreate, LeadResponse, LeadUpdate
from fastapi.middleware.cors import CORSMiddleware
from permissions import require_admin
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

from followup_reminders import send_due_reminders
scheduler = BackgroundScheduler(timezone="UTC")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        send_due_reminders,
        trigger="interval",
        minutes=1,
        id="followup_email_reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()

    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
app = FastAPI(
    title="Geni5 CRM API",
    version="0.2.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables for registered models.
Base.metadata.create_all(bind=engine)



def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ADD THE HELPERS HERE

def get_accessible_lead(
    lead_id: int,
    db: Session,
    current_user: User,
) -> Lead:
    lead = db.get(Lead, lead_id)

    if lead is None:
        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    if current_user.role == "admin":
        return lead

    if (
        current_user.role == "salesperson"
        and lead.assigned_to == current_user.id
    ):
        return lead

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to access this lead",
    )


def validate_salesperson(
    salesperson_id: int | None,
    db: Session,
) -> None:
    if salesperson_id is None:
        return

    salesperson = db.get(User, salesperson_id)

    if (
        salesperson is None
        or salesperson.role != "salesperson"
        or not salesperson.is_active
    ):
        raise HTTPException(
            status_code=400,
            detail="Assigned user must be an active salesperson",
        )

def validate_client(
    client_user_id: int | None,
    db: Session,
) -> None:
    if client_user_id is None:
        return

    client = db.get(User, client_user_id)

    if (
        client is None
        or client.role != "client"
        or not client.is_active
    ):
        raise HTTPException(
            status_code=400,
            detail="Selected user must be an active client account",
        )


@app.get("/")  


@app.get("/")
def home():
    return {"message": "Welcome to Geni5 CRM API"}



@app.get("/health/database")
def database_health_check(db: Session = Depends(get_db)):
    try:
        db.connection()
        return {"status": "healthy", "database": "connected"}
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed.",
        )


@app.post("/api/auth/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(data.email).lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    # Use the same message for unknown emails and incorrect passwords.
    if (
        user is None
        or not user.is_active
        or not verify_password(data.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_access_token(user.id, user.token_version)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user




@app.post(
    "/api/leads",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    data = payload.model_dump()

    if current_user.role == "salesperson":
        if data.get("assigned_to") not in (None, current_user.id):
            raise HTTPException(
                status_code=403,
                detail="Only admins can assign leads",
            )
        data["assigned_to"] = current_user.id
    else:
        validate_salesperson(data.get("assigned_to"), db)
        validate_client(data.get("client_user_id"), db)


    lead = Lead(**data)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead




@app.get("/api/leads", response_model=list[LeadResponse])
def list_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        query = select(Lead)
    elif current_user.role == "salesperson":
        query = select(Lead).where(
            Lead.assigned_to == current_user.id
        )
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return db.scalars(query.order_by(Lead.id.desc())).all()


@app.get("/api/leads/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    return get_accessible_lead(lead_id, db, current_user)




@app.patch("/api/leads/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    lead = get_accessible_lead(lead_id, db, current_user)
    changes = payload.model_dump(exclude_unset=True)

    if "assigned_to" in changes or "client_user_id" in changes:
        if current_user.role != "admin":
          raise HTTPException(
            status_code=403,
            detail="Only admins can reassign leads or change client assignments",
        )

    if "assigned_to" in changes:
      validate_salesperson(changes["assigned_to"], db)

    if "client_user_id" in changes:
      validate_client(changes["client_user_id"], db)

    for field, value in changes.items():
        setattr(lead, field, value)

    db.commit()
    db.refresh(lead)
    return lead



@app.delete(
    "/api/leads/{lead_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete leads",
        )

    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    db.delete(lead)
    db.commit()


@app.get(
    "/api/leads/{lead_id}/messages",
    response_model=list[MessageResponse],
)
def list_messages(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = db.get(Lead, lead_id)

    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.role == "client":
        if lead.client_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in ("admin", "salesperson"):
        get_accessible_lead(lead_id, db, current_user)
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    rows = db.execute(
        select(Message, User.full_name, User.role)
        .join(User, Message.sender_id == User.id)
        .where(Message.lead_id == lead_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    ).all()

    return [
        {
            "id": message.id,
            "lead_id": message.lead_id,
            "sender_id": message.sender_id,
            "sender_name": sender_name,
            "sender_role": sender_role,
            "body": message.body,
            "created_at": message.created_at,
        }
        for message, sender_name, sender_role in rows
    ]

def send_message_notification_email(
    email: str,
    recipient_name: str,
    notification: str,
) -> None:
    try:
        send_email(
            email,
            "New message - Geni5 CRM",
            (
                f"Hi {recipient_name},\n\n"
                f"{notification}\n\n"
                "Please log in to Geni5 CRM to view the message "
                "and reply.\n\n"
                "Geni5 CRM"
            ),
        )
    except Exception as exc:
        print(
            f"Failed to send message notification to {email}: {exc}"
        )


@app.post(
    "/api/leads/{lead_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    lead_id: int,
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = db.get(Lead, lead_id)

    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.role == "client":
        if lead.client_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in ("admin", "salesperson"):
        get_accessible_lead(lead_id, db, current_user)
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    body = payload.body.strip()
    if not body:
        raise HTTPException(
            status_code=422,
            detail="Message cannot be empty",
        )

    message = Message(
        lead_id=lead_id,
        sender_id=current_user.id,
        body=body,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

       
    # Send email notifications without affecting message delivery.
    recipients = {}

    try:
        # Client sends a message -> notify assigned salesperson.
        if current_user.role == "client":
            if lead.assigned_to:
                salesperson = db.get(User, lead.assigned_to)

                if (
                    salesperson
                    and salesperson.is_active
                    and salesperson.role == "salesperson"
                ):
                    recipients[salesperson.email] = (
                        salesperson.full_name,
                        "You have received a new message from a client.",
                    )

        # Salesperson sends a message -> notify the client.
        elif current_user.role == "salesperson":
            if lead.client_user_id:
                client = db.get(User, lead.client_user_id)

                if (
                    client
                    and client.is_active
                    and client.role == "client"
                ):
                    recipients[client.email] = (
                        client.full_name,
                        "Your Geni5 CRM contact has sent you a new message.",
                    )

        # Admin sends a message -> notify the client and assigned salesperson.
        elif current_user.role == "admin":
            if lead.client_user_id:
                client = db.get(User, lead.client_user_id)

                if (
                    client
                    and client.is_active
                    and client.role == "client"
                ):
                    recipients[client.email] = (
                        client.full_name,
                        "The Geni5 team has sent you a new message.",
                    )

            if lead.assigned_to:
                salesperson = db.get(User, lead.assigned_to)

                if (
                    salesperson
                    and salesperson.is_active
                    and salesperson.role == "salesperson"
                ):
                    recipients[salesperson.email] = (
                        salesperson.full_name,
                        "An admin has sent a new message on an assigned lead.",
                    )

        # Schedule email notifications in the background.
        for email, (recipient_name, notification) in recipients.items():
            # Never email the person who sent the message.
            if email.lower() == current_user.email.lower():
                continue

            background_tasks.add_task(
                send_message_notification_email,
                email,
                recipient_name,
                notification,
            )

    except Exception as exc:
        # Do not undo a successfully saved message.
        print(
            f"Failed to process message notifications "
            f"for lead {lead_id}: {exc}"
        )


    return {
        "id": message.id,
        "lead_id": message.lead_id,
        "sender_id": current_user.id,
        "sender_name": current_user.full_name,
        "sender_role": current_user.role,
        "body": message.body,
        "created_at": message.created_at,
    }

@app.get("/api/client/leads")
def list_client_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Clients only")

    leads = db.scalars(
        select(Lead)
        .where(Lead.client_user_id == current_user.id)
        .order_by(Lead.id.desc())
    ).all()

    results = []

    for lead in leads:
        salesperson = (
            db.get(User, lead.assigned_to)
            if lead.assigned_to is not None
            else None
        )

        results.append({
            "id": lead.id,
            "name": lead.name,
            "company": lead.company,
            "status": lead.status,
            "salesperson_name": (
                salesperson.full_name if salesperson else None
            ),
        })

    return results




@app.patch("/api/leads/{lead_id}/client")
def assign_client_to_lead(
    lead_id: int,
    payload: ClientAssignment,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    lead = db.get(Lead, lead_id)

    if lead is None:
        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    client_user_id = payload.client_user_id

    if client_user_id is not None:
        client = db.get(User, client_user_id)

        if (
            client is None
            or client.role != "client"
            or not client.is_active
        ):
            raise HTTPException(
                status_code=400,
                detail="Client must be an active client account",
            )

    lead.client_user_id = client_user_id
    db.commit()
    db.refresh(lead)

    return {
        "message": "Client assignment updated",
        "lead_id": lead.id,
        "client_user_id": lead.client_user_id,
    }




@app.post(
    "/api/follow-ups",
    response_model=FollowUpResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_follow_up(
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    get_accessible_lead(payload.lead_id, db, current_user)

    follow_up = FollowUp(**payload.model_dump())
    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)
    return follow_up




@app.get("/api/follow-ups", response_model=list[FollowUpResponse])
def list_follow_ups(
    status_filter: str | None = None,
    lead_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(FollowUp).join(Lead)

    if current_user.role == "salesperson":
        query = query.where(Lead.assigned_to == current_user.id)

    if status_filter is not None:
        if status_filter not in ("Pending", "Completed"):
            raise HTTPException(
                status_code=400,
                detail="Status must be Pending or Completed",
            )
        query = query.where(FollowUp.status == status_filter)

    if lead_id is not None:
        get_accessible_lead(lead_id, db, current_user)
        query = query.where(FollowUp.lead_id == lead_id)

    return db.scalars(query.order_by(FollowUp.due_at.asc())).all()




@app.patch(
    "/api/follow-ups/{follow_up_id}",
    response_model=FollowUpResponse,
)
def update_follow_up(
    follow_up_id: int,
    payload: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    follow_up = db.get(FollowUp, follow_up_id)
    if follow_up is None:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    get_accessible_lead(follow_up.lead_id, db, current_user)

    changes = payload.model_dump(exclude_unset=True)

    # Do not allow moving a follow-up to another lead without
    # separately validating that destination lead.
    if "lead_id" in changes:
        get_accessible_lead(changes["lead_id"], db, current_user)

    for field, value in changes.items():
        setattr(follow_up, field, value)

    db.commit()
    db.refresh(follow_up)
    return follow_up




@app.delete(
    "/api/follow-ups/{follow_up_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_follow_up(
    follow_up_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    follow_up = db.get(FollowUp, follow_up_id)
    if follow_up is None:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    get_accessible_lead(follow_up.lead_id, db, current_user)

    db.delete(follow_up)
    db.commit()




@app.post(
    "/api/activities",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activity(
    payload: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    get_accessible_lead(payload.lead_id, db, current_user)

    activity_data = payload.model_dump(exclude={"occurred_at"})
    activity = Activity(
        **activity_data,
        occurred_at=payload.occurred_at or datetime.now(timezone.utc),
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity




@app.get("/api/activities", response_model=list[ActivityResponse])
def list_activities(
    lead_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(Activity).join(Lead)

    if current_user.role == "salesperson":
        query = query.where(Lead.assigned_to == current_user.id)

    if lead_id is not None:
        get_accessible_lead(lead_id, db, current_user)
        query = query.where(Activity.lead_id == lead_id)

    return db.scalars(query.order_by(Activity.occurred_at.desc())).all()




@app.delete(
    "/api/activities/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "salesperson"):
        raise HTTPException(status_code=403, detail="Access denied")

    activity = db.get(Activity, activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")

    get_accessible_lead(activity.lead_id, db, current_user)

    db.delete(activity)
    db.commit()



@app.get(
    "/api/users",
    response_model=list[AdminUserResponse],
)
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return db.scalars(
        select(User).order_by(User.id.asc())
    ).all()



@app.post(
    "/api/users",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    email = str(payload.email).strip().lower()
    full_name = payload.full_name.strip()

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="Full name cannot be empty.",
        )

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists.",
        )

    # An unusable random password is stored until activation.
    temporary_password = secrets.token_urlsafe(32)

    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(temporary_password),
        role=payload.role,
        is_active=False,
    )

    try:
        db.add(user)
        db.flush()

        raw_token = create_auth_token(db, user, "invitation")

        send_auth_email(
            user.email,
            user.full_name,
            "invitation",
            raw_token,
        )

        db.commit()
        db.refresh(user)

        return user

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists.",
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to create the account or send its invitation. "
                "Please retry."
            ),
        )



@app.patch(
    "/api/users/{user_id}",
    response_model=AdminUserResponse,
)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    changes = payload.model_dump(exclude_unset=True)

    
    if "role" in changes and changes["role"] is None:
        raise HTTPException(
            status_code=400,
            detail="Role cannot be empty.",
        )

    if "is_active" in changes and changes["is_active"] is None:
        raise HTTPException(
            status_code=400,
            detail="Active status cannot be empty.",
        )


    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one field to update.",
        )

    # Prevent accidentally removing the current admin's access.
    if user.id == admin.id:
        if changes.get("is_active") is False:
            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account.",
            )

        if "role" in changes:
            raise HTTPException(
                status_code=400,
                detail="You cannot change your own role here.",
            )

    if "email" in changes:
        if changes["email"] is None:
            raise HTTPException(
                status_code=400,
                detail="Email cannot be empty.",
            )

        changes["email"] = str(changes["email"]).strip().lower()

        existing_user = db.scalar(
            select(User).where(
                User.email == changes["email"],
                User.id != user.id,
            )
        )

        if existing_user is not None:
            raise HTTPException(
                status_code=409,
                detail="A user with this email already exists.",
            )

    if "full_name" in changes:
        if changes["full_name"] is None:
            raise HTTPException(
                status_code=400,
                detail="Full name cannot be empty.",
            )

        changes["full_name"] = changes["full_name"].strip()

        if not changes["full_name"]:
            raise HTTPException(
                status_code=400,
                detail="Full name cannot be empty.",
            )

    if "password" in changes:
        if changes["password"] is None:
            raise HTTPException(
                status_code=400,
                detail="Password cannot be empty.",
            )

        changes["hashed_password"] = hash_password(
            changes.pop("password")
        )

    
    security_changed = (
    "role" in changes or "is_active" in changes
)

    for field, value in changes.items():
      setattr(user, field, value)

    if security_changed:
      user.token_version += 1


    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The update conflicts with an existing user.",
        )

    return user


@app.delete(
    "/api/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    if user.id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account.",
        )

    try:
        # Clear references to this user on existing leads.
        db.query(Lead).filter(
            Lead.assigned_to == user_id
        ).update(
            {Lead.assigned_to: None},
            synchronize_session=False,
        )

        db.query(Lead).filter(
            Lead.client_user_id == user_id
        ).update(
            {Lead.client_user_id: None},
            synchronize_session=False,
        )

        # Message.sender_id uses ON DELETE RESTRICT.
        # Preserve message history; don't delete the user if messages
        # still reference them.
        existing_message = db.scalar(
            select(Message.id)
            .where(Message.sender_id == user_id)
            .limit(1)
        )

        if existing_message is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This user has sent messages and cannot be "
                    "permanently deleted without affecting message history."
                ),
            )

        db.delete(user)
        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "This user is still referenced by other records "
                "and cannot be deleted."
            ),
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not delete user.",
        )




@app.post("/api/users/{user_id}/send-invitation")
def send_user_invitation(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role not in ("salesperson", "client"):
        raise HTTPException(
            status_code=400,
            detail="Only salesperson and client accounts can be invited",
        )

    raw_token = create_auth_token(db, user, "invitation")

    try:
        send_auth_email(
            user.email,
            user.full_name,
            "invitation",
            raw_token,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail="Unable to send the invitation email. Please try again.",
        )

    return {"message": "Invitation email sent"}


@app.post("/api/auth/activate")
def activate_account(
    payload: ActivateAccountRequest,
    db: Session = Depends(get_db),
):
    try:
        token_record, user = redeem_auth_token(
            db, payload.token, "invitation"
        )

        if user.is_active:
            raise HTTPException(
                status_code=400,
                detail="This account is already active. Please sign in.",
            )

        set_user_password(user, payload.password)
        user.is_active = True

        db.commit()

        return {"message": "Account activated successfully. You can now sign in."}

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to activate account. Please try again.",
        )



@app.post("/api/auth/forgot-password")
def forgot_password(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    generic_response = {
        "message": "If an eligible account exists, a password reset email will be sent."
    }

    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))

    if user is None or not user.is_active:
        return generic_response

    raw_token = create_auth_token(db, user, "password_reset")

    try:
        send_auth_email(
            user.email,
            user.full_name,
            "password_reset",
            raw_token,
        )
        db.commit()
    except Exception:
        db.rollback()
        # Do not expose SMTP details or account information.
        return generic_response

    return generic_response



@app.post("/api/auth/reset-password")
def reset_password(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    try:
        token_record, user = redeem_auth_token(
            db, payload.token, "password_reset"
        )

        set_user_password(user, payload.password)
        user.token_version += 1

        db.commit()

        return {
            "message": "Password reset successfully. Please sign in again."
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to reset password. Please try again.",
        )
