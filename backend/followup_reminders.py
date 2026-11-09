
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
from sqlalchemy import select

from database import SessionLocal
from models import FollowUp, Lead, User
from auth_email import send_email


def send_due_reminders() -> None:
    now = datetime.now(timezone.utc)
    reminder_cutoff = now + timedelta(minutes=15)

    db = SessionLocal()

    try:
        rows = db.execute(
            select(FollowUp, Lead, User)
            .join(Lead, FollowUp.lead_id == Lead.id)
            .join(User, Lead.assigned_to == User.id)
            .where(
                FollowUp.status == "Pending",
                FollowUp.reminder_sent_at.is_(None),
                FollowUp.due_at >= now,
                FollowUp.due_at <= reminder_cutoff,
                User.role == "salesperson",
                User.is_active.is_(True),
            )
            .order_by(FollowUp.due_at.asc())
        ).all()

        for follow_up, lead, salesperson in rows:
            subject = f"Upcoming follow-up: {follow_up.title}"

            body = (
                f"Hi {salesperson.full_name},\n\n"
                "This is a reminder about an upcoming CRM follow-up.\n\n"
                f"Task: {follow_up.title}\n"
                f"Lead: {lead.name}\n"
                f"Company: {lead.company or 'Not specified'}\n"
                f"Due: {follow_up.due_at.astimezone(IST).strftime('%d %b %Y, %I:%M %p IST')}\n"
                f"Notes: {follow_up.notes or 'None'}\n\n"
                "Please open Geni5 CRM to review the follow-up.\n\n"
                "Geni5 CRM"
            )

            try:
                send_email(salesperson.email, subject, body)
                follow_up.reminder_sent_at = datetime.now(timezone.utc)
                db.commit()
            except Exception:
                db.rollback()
                # Log the error in production; leave the reminder
                # unsent so a later scheduler run can retry.
                continue

    finally:
        db.close()
