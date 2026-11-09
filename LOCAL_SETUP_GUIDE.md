# Geni5 CRM — Local Setup Guide (Windows)

## Prerequisites

Install the following before starting:

- Python version compatible with the project requirements
- Node.js and npm
- PostgreSQL
- Visual Studio Code

## 1. Extract the project

Extract the CRM ZIP file and open the project folder in VS Code.

The project contains two main folders: `backend` and `frontend`.

## 2. Create the PostgreSQL database

Start PostgreSQL and open its SQL interface, such as pgAdmin or `psql`.

Create a database user and database:

```sql
CREATE USER geni5_crm_user WITH PASSWORD 'USE_A_STRONG_PASSWORD';
CREATE DATABASE geni5_crm OWNER geni5_crm_user;
```

Use your own strong password. Remember it for the backend configuration.

## 3. Configure the backend

Create a file named `.env` inside the `backend` folder.

Add the following configuration, replacing the placeholders with your own values:

```env
DATABASE_URL=postgresql+psycopg://geni5_crm_user:URL_ENCODED_PASSWORD@localhost:5432/geni5_crm
JWT_SECRET_KEY=REPLACE_WITH_A_NEW_SECRET_AT_LEAST_32_CHARACTERS_LONG
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
FRONTEND_BASE_URL=http://localhost:3000
```

If email functionality is required, configure the SMTP settings using valid credentials.

**Important:** The database password in `DATABASE_URL` must match the password used when creating the PostgreSQL user. URL-encode special characters in the password if necessary.

Do not share real passwords, JWT secrets, or SMTP credentials.

## 4. Install backend dependencies

Open a PowerShell terminal in VS Code and run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks virtual-environment activation, use an approved local execution-policy workaround or activate the environment using another supported terminal.

## 5. Create the initial admin account

Make sure PostgreSQL is running and the backend `.env` configuration is correct.

From the `backend` directory, run:

```powershell
python create_admin.py
```

Follow the prompts to create an admin account using a valid email address and a strong password.(Password must be between 12 and 128 characters.)

Run this step only when an admin account needs to be created. If an admin already exists, use the existing account.

## 6. Start the backend

From the `backend` directory, run:

```powershell
uvicorn main:app --reload
```

Keep this terminal running. The backend should be available at:

`http://127.0.0.1:8000`

## 7. Configure the frontend

Open a second terminal in VS Code and navigate to the frontend directory:

```powershell
cd frontend
```

Create a file named `.env.local` inside the `frontend` folder with:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## 8. Install frontend dependencies and start the app

From the `frontend` directory, run:

```powershell
npm ci
npm run dev
```

Keep this terminal running too.

## 9. Open the CRM

Open the following address in your browser:

`http://localhost:3000`

Log in using the admin account created earlier.

## Important notes

- Both the backend and frontend terminals must remain running while using the CRM.
- PostgreSQL must be running, and the backend database configuration must be correct.
- Email features such as invitations and password-reset emails require valid SMTP configuration.
- The current `create_all()` setup creates missing database tables but does not migrate existing schemas when models change.
- This guide covers running the application locally. It does not configure public hosting or production deployment.
- Do not include `.env` files, passwords, API secrets, database dumps, `.venv`, `node_modules`, or `.next` in the shared ZIP file.