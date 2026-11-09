import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

host = os.environ["SMTP_HOST"]
port = int(os.getenv("SMTP_PORT", "465"))
username = os.environ["SMTP_USER"]
password = os.environ["SMTP_PASS"]
sender = os.getenv("SMTP_FROM_EMAIL", username)

recipient = input("Enter your own email address for the test: ").strip()

message = EmailMessage()
message["Subject"] = "Geni5 CRM SMTP test"
message["From"] = f"Geni5 CRM <{sender}>"
message["To"] = recipient
message.set_content(
    "SMTP is working. Geni5 CRM can now proceed with email onboarding."
)

try:
    context = ssl.create_default_context()

    with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as server:
        server.login(username, password)
        server.send_message(message)

    print("SUCCESS: Test email sent.")

except (smtplib.SMTPException, OSError) as exc:
    print(f"FAILED: {type(exc).__name__}: {exc}")