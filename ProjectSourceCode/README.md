# FRD/EPICS Automation — Developer Setup Guide

A web application that guides Business Analysts through creating complete Product Requirements Documents (FRD/PRD) with AI-powered field suggestions, and auto-generates EPICS from them.

## Architecture

```text
ProjectSourceCode/
├── frontend/         Next.js 14 (App Router) + Tailwind CSS + shadcn/ui  → :3000
├── backend/          NestJS REST API + Prisma ORM + PostgreSQL            → :4000
├── ai-service/       Python FastAPI + OpenAI GPT-4.5                      → :5000
├── tests/            Playwright E2E + Jest + Pytest
└── docker-compose.yml
```

| Service    | Technology                 | Port |
|------------|----------------------------|------|
| Frontend   | Next.js 14, React 18, TS   | 3000 |
| Backend    | NestJS, Prisma, TypeScript | 4000 |
| AI Service | Python 3.12, FastAPI       | 5000 |
| Database   | PostgreSQL 16              | 5432 |

---

## Prerequisites

| Tool           | Version | Notes                       |
|----------------|---------|-----------------------------|
| Docker Desktop | ≥ 4.x   | Required for Docker path    |
| Docker Compose | ≥ 2.x   | Bundled with Docker Desktop |
| Node.js        | ≥ 20.x  | Local dev only              |
| Python         | ≥ 3.12  | Local dev only              |
| Git            | any     |                             |

---

## Option A — Docker (Recommended)

This is the fastest way to bring up all four services with a single command.

### Step 1 — Copy environment files

```bash
# From the ProjectSourceCode/ directory
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
```

**Windows PowerShell:**

```powershell
Copy-Item frontend\.env.example frontend\.env
Copy-Item backend\.env.example backend\.env
Copy-Item ai-service\.env.example ai-service\.env
```

### Step 2 — Add your OpenAI API key

Open `ai-service/.env` and set:

```env
OPENAI_API_KEY=sk-your-real-key-here
```

> The AI suggestion features will return errors without a valid key. All other features work without it.

### Step 3 — Start all services

```bash
# Build images and start all containers in the foreground
docker compose up --build

# Or run detached (background)
docker compose up --build -d
```

### Step 4 — Verify all services are up

| URL                                         | Expected response  |
|---------------------------------------------|--------------------|
| <http://localhost:3000>                     | Frontend UI loads  |
| <http://localhost:4000/health>              | `{"status":"ok"}`  |
| <http://localhost:5000/health>              | `{"status":"ok"}`  |

### Common Docker commands

```bash
# Stop all containers
docker compose down

# Stop and remove volumes (wipes database)
docker compose down -v

# Rebuild a single service
docker compose up --build backend

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f ai-service
docker compose logs -f frontend

# Restart a single service
docker compose restart backend
```

---

## Option B — Local Development (without Docker)

Run each service natively for faster hot-reload and easier debugging.

> You still need **PostgreSQL** running locally (or keep the DB container running from Docker: `docker compose up postgres`).

### 1. Database (PostgreSQL via Docker)

```bash
# Start only the database container
docker compose up postgres -d
```

This exposes PostgreSQL at `localhost:5432` with:

- Database: `new_prd_generator`
- User: `prd_user`
- Password: `prd_secret`

---

### 2. AI Service

```bash
cd ai-service

# Create and activate a virtual environment
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env → set OPENAI_API_KEY

# Start the service with hot-reload
uvicorn main:app --reload --port 5000
```

Service available at: <http://localhost:5000>

---

### 3. Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# .env already has correct defaults for local dev

# Generate Prisma client
npx prisma generate

# Push schema to the database (creates tables)
npx prisma db push

# Start with hot-reload
npm run start:dev
```

Service available at: <http://localhost:4000>

**Optional — open Prisma Studio (visual DB browser):**

```bash
npm run prisma:studio   # opens at http://localhost:5555
```

---

### 4. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start dev server
npm run dev
```

App available at: <http://localhost:3000>

---

## Environment Variables Reference

### `frontend/.env`

| Variable              | Default                 | Description          |
|-----------------------|-------------------------|----------------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |
| `PORT`                | `3000`                  | Frontend port        |

### `backend/.env`

| Variable         | Default                                                         | Description                  |
|------------------|-----------------------------------------------------------------|------------------------------|
| `DATABASE_URL`   | `postgresql://prd_user:prd_secret@localhost:5432/prd_generator` | PostgreSQL connection string |
| `AI_SERVICE_URL` | `http://localhost:5000`                                         | AI service base URL          |
| `PORT`           | `4000`                                                          | Backend port                 |
| `CORS_ORIGINS`   | `http://localhost:3000`                                         | Allowed CORS origins         |

### `ai-service/.env`

| Variable         | Default                 | Description          |
|------------------|-------------------------|----------------------|
| `OPENAI_API_KEY` | *(required)*            | Your OpenAI API key  |
| `OPENAI_MODEL`   | `gpt-4.5-preview`       | OpenAI model to use  |
| `PORT`           | `5000`                  | AI service port      |
| `CORS_ORIGINS`   | `http://localhost:4000` | Allowed CORS origins |

> **Security:** Never commit `.env` files with real secrets. Only `.env.example` files are committed.

---

## Running Tests

### Structural validation (no services required)

```bash
node --test tests/task1-structure.test.mjs
```

### Frontend unit tests

```bash
cd frontend
npm test
```

### Backend unit tests

```bash
cd backend
npm test
```

### AI Service tests

```bash
cd ai-service
source .venv/bin/activate   # or .venv\Scripts\Activate.ps1 on Windows
pytest
```

### E2E tests (requires all services running)

```bash
cd frontend
npm run test:e2e
```

---

## Troubleshooting

### Port already in use

```bash
# Find and kill the process using a port (Windows PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process -Force

# macOS / Linux
lsof -ti :4000 | xargs kill
```

### Docker build fails with npm errors

```bash
# Clear Docker build cache and rebuild
docker compose build --no-cache
docker compose up
```

### Backend: `Cannot connect to database`

- Ensure PostgreSQL is running: `docker compose ps postgres`
- Check `DATABASE_URL` in `backend/.env` matches the DB credentials
- Run `npx prisma db push` to sync the schema

### Backend: `Prisma Client is not generated`

```bash
cd backend
npx prisma generate
```

### AI Service: `401 Unauthorized` from OpenAI

- Verify `OPENAI_API_KEY` is set correctly in `ai-service/.env`
- Ensure the key has sufficient credits/quota

### Frontend: blank page or API errors

- Check `NEXT_PUBLIC_API_URL` in `frontend/.env` points to the running backend
- Verify backend is healthy: `curl http://localhost:4000/health`

### Windows: `.venv\Scripts\Activate.ps1` blocked by execution policy

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Sprint Progress

| Sprint | Status      | Description                                                    |
|--------|-------------|----------------------------------------------------------------|
| v1     | Complete    | Core scaffold, 22-section PRD form, AI suggestions, PDF export |
| v2     | Complete    | EPICS generation, module mapping, traceability matrix          |
| v3     | Complete    | LLD generation, DOCX export, RTM enhancements                  |
| v4     | In Progress | Discovery track, export parity, FRD pilot                      |

Sprint details: `sprints/<version>/PRD.md` and `sprints/<version>/TASKS.md`
