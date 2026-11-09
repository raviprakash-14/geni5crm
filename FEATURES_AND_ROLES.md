# Geni5 CRM — Features, Roles & Project Overview

## 1. What Is Geni5 CRM?

Geni5 CRM is a customer relationship management application designed to help a team manage leads, track follow-up activities, communicate with clients, and organize customer-related work in one place.

The application has three main user roles: **Admin, Salesperson, and Client**. Each role is intended to provide access to the information and functionality relevant to that user.

The project has a web frontend, a Python backend API, and a PostgreSQL database.


## 2. Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | User interface and web application |
| Backend | Python, FastAPI | API endpoints and business logic |
| Database | PostgreSQL | Stores application data |
| ORM | SQLAlchemy | Connects application code to database tables |
| Authentication | JWT | Authenticates users through tokens |
| Password security | `pwdlib` | Password hashing and verification |
| Scheduled tasks | APScheduler | Runs scheduled jobs, including follow-up reminders |
| Frontend package manager | npm | Installs frontend dependencies and runs development scripts |

## 3. User Roles

The application is organized around three user roles.

### Admin

The Admin is intended to manage users and oversee CRM operations.

Expected responsibilities include:
- Managing users and roles.
- Inviting users to join the application.
- Managing access to CRM functionality.
- Overseeing leads and related activities where permitted.

### Salesperson

The Salesperson uses the CRM to manage assigned leads and customer interactions.

Expected responsibilities include:
- Viewing and managing assigned leads.
- Tracking follow-ups.
- Recording activity notes.
- Communicating with clients.

### Client

The Client role is intended to provide access to relevant client or lead information and communication features.

Expected responsibilities include:
- Accessing authorized information related to their account or lead.
- Communicating with the assigned salesperson.


## 4. Features Identified in the Codebase

The following features have been identified in the project code. Their presence in the code does not, by itself, confirm that every workflow has been fully tested.

### Authentication and Account Management

- User login.
- JWT-based authentication.
- Password hashing and verification.
- User management.
- User invitations and account activation.
- Password reset functionality.
- Initial Admin account creation through a backend script.

### Lead Management

- Lead creation, retrieval, updating, and deletion (CRUD).
- Lead assignment.
- Access to lead information according to the intended user role.

### Follow-ups and Activities

- Follow-up management.
- Activity tracking and notes.
- Scheduled jobs for follow-up reminders.

### Communication

- Client messaging functionality.
- Email-dependent workflows for invitations and password resets, subject to SMTP configuration.

### Database Initialization

- SQLAlchemy database models.
- Database connection through environment configuration.
- Automatic creation of missing tables through `Base.metadata.create_all()` during backend startup.

**Important:** Automatic table creation is not a substitute for database migrations when an existing schema needs to change.

## 5. How the Application Works

At a high level, the application follows this flow:

1. A user opens the CRM frontend in a browser.
2. The frontend sends requests to the FastAPI backend.
3. The backend validates requests, authenticates users, and applies application logic.
4. The backend reads or updates data in PostgreSQL.
5. The frontend displays the returned information to the user.

The backend also runs scheduled jobs for follow-up reminders.

### Project Structure

```text
geni5-crm/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── create_admin.py
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── .env.local
│   └── ...
├── FEATURES_AND_ROLES.md
└── LOCAL_SETUP_GUIDE.md
```

The structure above is illustrative. Some files may differ as the project evolves.

## 6. Known Limitations and Items Requiring Further Work

The following points should be considered during development and handover.

| Item | Current understanding |
|---|---|
| Database schema changes | `create_all()` creates missing tables but does not migrate existing schemas. A migration strategy is needed for schema changes. |
| Google Calendar | The application currently has a Google Calendar shortcut. A fully integrated calendar workflow has not been confirmed.
|Email functionality| Invitations, account activation, password resets, and reminders depend on correct SMTP configuration and successful email delivery.


## 7. Important Configuration Files

### Backend: `backend/.env`

Contains backend configuration, including:
- PostgreSQL connection string.
- JWT secret and authentication settings.
- Frontend base URL.
- SMTP settings.

### Frontend: `frontend/.env.local`

Contains frontend environment configuration, including:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Use the appropriate API URL for the environment where the application is running.

**Security:** Do not commit or share real `.env` files containing passwords, tokens, or other secrets. Provide a sanitized example configuration when necessary.

## 8. Getting Started

For installation instructions, prerequisites, database setup, and commands to run the application, see:

**[`LOCAL_SETUP_GUIDE.md`](./LOCAL_SETUP_GUIDE.md)**

