# FRD-EPICS-Automation — Windows Setup Guide

End-to-end setup steps for bringing up the **PRD Generator** and **BA (Business Analyst) Tool** on a Windows 10 / 11 developer machine.

> Both tools live in the same monorepo and share one frontend + backend + AI service + Postgres database. The `/prd/...` routes drive the PRD Generator and the `/ba-tool/...` routes drive the BA Tool.

---

## 1. Architecture at a Glance

```
ProjectSourceCode/
├── frontend/        Next.js 14 (App Router) + Tailwind + shadcn/ui   → http://localhost:3000
│   └── app/
│       ├── prd/...        ← PRD Generator pages
│       └── ba-tool/...    ← BA Tool pages (FRD/Modules/Stories/SubTasks/LLD/FTC)
├── backend/         NestJS REST API + Prisma ORM (PostgreSQL)        → http://localhost:4000
│   └── src/
│       ├── prd/...        ← PRD endpoints
│       └── ba-tool/...    ← BA Tool endpoints
├── ai-service/      Python FastAPI + OpenAI                          → http://localhost:5000
└── docker-compose.yml
```

Repository: <https://github.com/saurabhdeepmindz/FRD-EPICS-Automation>

---

## 2. Prerequisites

Install the following on Windows. **Tick each one off before continuing.**

| Tool | Version | Where to get it | Notes |
|---|---|---|---|
| **Git for Windows** | latest | <https://git-scm.com/download/win> | Includes Git Bash — most commands in this doc are bash-style |
| **Node.js LTS** | 20.x | <https://nodejs.org/en/download> | Use the MSI installer; verify with `node -v` |
| **Python** | 3.12.x | <https://www.python.org/downloads/windows/> | Tick **"Add python.exe to PATH"** during install |
| **PostgreSQL** | 16.x | <https://www.postgresql.org/download/windows/> | Required if you choose the **native** DB option (§4-A). Skip if using Docker. |
| **Docker Desktop** | 4.x | <https://www.docker.com/products/docker-desktop/> | Optional but recommended — lets you skip native Postgres install |
| **VS Code** | latest | <https://code.visualstudio.com/> | Optional editor |

### One-time Windows housekeeping (run **once** in an **elevated** PowerShell)

```powershell
# Allow long paths (npm + Next.js produce deep node_modules trees)
git config --system core.longpaths true

# Allow local PowerShell scripts (npm, venv activation, etc.)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Verify versions

```powershell
node -v        # v20.x.x
npm -v         # 10.x.x
python --version   # 3.12.x
git --version
psql --version     # only if you installed Postgres natively
docker --version   # only if you installed Docker
```

---

## 3. Clone the Repository

```bash
# Pick a folder without spaces in the path
cd D:/work
git clone https://github.com/saurabhdeepmindz/FRD-EPICS-Automation.git
cd FRD-EPICS-Automation
```

All subsequent commands assume your working directory is the repo root unless stated otherwise.

---

## 4. Database (PostgreSQL 16)

Pick **one** of the two options below.

### Option 4-A — Native PostgreSQL on Windows (recommended for daily dev)

1. Run the EnterpriseDB installer; during setup remember the **postgres** superuser password.
2. Open **pgAdmin** (or `psql` from the Start menu) and create the application role + database:

   ```sql
   CREATE USER prd_user WITH PASSWORD 'prd_secret';
   CREATE DATABASE prd_generator OWNER prd_user;
   GRANT ALL PRIVILEGES ON DATABASE prd_generator TO prd_user;
   ```

3. **Restore the backup** (`prd_generator-backup.sql`, ~83 MB at the repo root). It's a custom-format dump, so use `pg_restore`, not `psql`:

   ```powershell
   # From repo root, with PostgreSQL bin on your PATH
   pg_restore --no-owner --no-privileges --clean --if-exists `
       -U prd_user -d prd_generator `
       prd_generator-backup.sql
   ```

   > If `pg_restore` is not on PATH, prefix with the full path, e.g. `"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"`.
   >
   > If you'd rather start with an empty schema, **skip the restore** — `npx prisma db push` (§6) will create the tables from the Prisma schema.

4. Verify:

   ```powershell
   psql -U prd_user -d prd_generator -c "\dt"
   ```

### Option 4-B — Postgres via Docker Desktop (zero-install)

Run **only** the database container from the compose file:

```bash
cd ProjectSourceCode
docker compose up -d postgres
```

This brings Postgres up at `localhost:5432` with the credentials baked into [docker-compose.yml](ProjectSourceCode/docker-compose.yml#L8-L11):

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `prd_generator` |
| User | `prd_user` |
| Password | `prd_secret` |

To restore the SQL backup into the container:

```bash
# From repo root
docker cp prd_generator-backup.sql prd-gen-db:/tmp/backup.sql
docker exec -it prd-gen-db pg_restore --no-owner --no-privileges --clean --if-exists \
    -U prd_user -d prd_generator /tmp/backup.sql
```

---

## 5. Environment Files

Each service has a `.env.example`. Copy it once and fill in secrets.

```bash
cd ProjectSourceCode

# Backend
cp backend/.env.example backend/.env

# AI service
cp ai-service/.env.example ai-service/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

> PowerShell users: replace `cp` with `Copy-Item`.

Edit each file:

### `ProjectSourceCode/backend/.env`

```env
DATABASE_URL="postgresql://prd_user:prd_secret@localhost:5432/prd_generator"
AI_SERVICE_URL=http://localhost:5000
PORT=4000
CORS_ORIGINS=http://localhost:3000
```

### `ProjectSourceCode/ai-service/.env`

```env
OPENAI_API_KEY=sk-...your-real-key...
OPENAI_MODEL=gpt-4.5-preview
PORT=5000
CORS_ORIGINS=http://localhost:4000
```

> **Required:** drop a working OpenAI API key here. Without it, all AI-driven flows (skill executions, suggestion endpoints) will 401/500.

### `ProjectSourceCode/frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
PORT=3000
```

> **Never commit** `.env`, `.env.local`, or any file containing real secrets.

---

## 6. Bring Up the Backend (NestJS + Prisma)

Open a dedicated terminal for the backend and **leave it running**.

```bash
cd ProjectSourceCode/backend

# Install dependencies (~2-3 min on first run)
npm install

# Generate the Prisma client from prisma/schema.prisma
npx prisma generate

# Sync the schema to your local database.
# - If you restored the SQL dump, this is a no-op / minor diff.
# - If you started empty, it creates every table.
npx prisma db push

# (Optional) launch Prisma Studio to browse data — http://localhost:5555
# npx prisma studio

# Start in watch mode
npm run start:dev
```

You should see `Nest application successfully started` and the API responding at <http://localhost:4000>.

Smoke test:

```powershell
curl http://localhost:4000/health
```

---

## 7. Bring Up the AI Service (Python FastAPI)

Open a second terminal.

```powershell
cd ProjectSourceCode/ai-service

# Create and activate a virtual env
python -m venv .venv
.venv\Scripts\activate     # PowerShell / cmd
# Git Bash equivalent:    source .venv/Scripts/activate

# Install pinned dependencies
pip install -r requirements.txt

# Run the FastAPI app
uvicorn main:app --reload --port 5000
```

You should see `Uvicorn running on http://0.0.0.0:5000`. Smoke test:

```powershell
curl http://localhost:5000/health
```

---

## 8. Bring Up the Frontend (Next.js)

Open a third terminal.

```bash
cd ProjectSourceCode/frontend

npm install
npm run dev
```

When it prints `Ready - started server on 0.0.0.0:3000`, open the apps in your browser:

| Application | URL |
|---|---|
| **PRD Generator** | <http://localhost:3000/prd/new> |
| **BA Tool** | <http://localhost:3000/ba-tool> |
| **Dashboard** | <http://localhost:3000/dashboard> |

---

## 9. One-Shot Alternative — Docker Compose

If you'd rather skip §6–§8 and run everything in containers:

```bash
cd ProjectSourceCode

# Make sure backend/.env, ai-service/.env, frontend/.env exist (§5)

docker compose up --build
```

This starts **all four** services (Postgres, backend, AI service, frontend). Stop with `Ctrl+C`, or `docker compose down -v` to also wipe the database volume.

---

## 10. Daily Workflow (after first-time setup)

Three terminals, one command each:

| Terminal | Command |
|---|---|
| 1 | `cd ProjectSourceCode/backend && npm run start:dev` |
| 2 | `cd ProjectSourceCode/ai-service && .venv\Scripts\activate && uvicorn main:app --reload --port 5000` |
| 3 | `cd ProjectSourceCode/frontend && npm run dev` |

Pull updates with `git pull`, then rerun:

```bash
# In backend/  →  if Prisma schema changed
npx prisma generate && npx prisma db push

# In any folder  →  if package.json changed
npm install
```

---

## 11. Running the Tests

```bash
# Backend unit tests
cd ProjectSourceCode/backend && npm test

# Frontend unit tests
cd ProjectSourceCode/frontend && npm test

# Frontend E2E (Playwright) — requires all 3 services running
cd ProjectSourceCode/frontend && npm run test:e2e

# Repo-level structural checks
node --test ProjectSourceCode/tests/task1-structure.test.mjs
```

---

## 12. Common Windows Gotchas

| Symptom | Fix |
|---|---|
| `EPERM: operation not permitted` on `npm install` | Close VS Code / file explorer that has `node_modules` open, or run terminal as Administrator |
| `Filename too long` during `git clone` or `npm install` | Run `git config --system core.longpaths true` (one-time, elevated PowerShell) |
| `psql: could not connect to server` | Confirm Postgres service is running — `services.msc` → **postgresql-x64-16** → Start. For Docker, `docker ps` should list `prd-gen-db`. |
| `Port 3000/4000/5000 already in use` | Find the offender and kill it: `netstat -ano \| findstr :4000` then `taskkill /PID <pid> /F` |
| `prisma generate` fails with `EPERM` on Windows | Stop the dev server (it locks `query_engine-windows.dll.node`) and retry |
| `python` opens the Microsoft Store | Reinstall Python from python.org with **Add to PATH** ticked, then restart the terminal |
| `Activate.ps1 cannot be loaded` for venv | Run the elevated `Set-ExecutionPolicy` command from §2 |
| `OpenAI 401` or skill execution failures | The key in `ai-service/.env` is missing or expired. Update it and restart the AI service. |
| `pg_restore: error: input file appears to be a text format dump` | The backup is custom-format — use `pg_restore`, **not** `psql -f`. |
| Frontend can't reach backend (`ECONNREFUSED`) | `NEXT_PUBLIC_API_URL` mismatch in `frontend/.env.local`, or backend not running. |
| Containers can't talk to each other | When using Docker Compose, services must reference each other by **service name** (e.g. `postgres`, `ai-service`) — not `localhost`. The committed compose file already does this. |

---

## 13. Useful Project Paths

| Path | What's there |
|---|---|
| [ProjectSourceCode/README.md](ProjectSourceCode/README.md) | Original (cross-platform) project README |
| [ProjectSourceCode/backend/prisma/schema.prisma](ProjectSourceCode/backend/prisma/schema.prisma) | Authoritative DB schema |
| [ProjectSourceCode/backend/src/ba-tool/](ProjectSourceCode/backend/src/ba-tool/) | BA Tool backend (skill orchestrator, parsers, controllers) |
| [ProjectSourceCode/frontend/app/ba-tool/](ProjectSourceCode/frontend/app/ba-tool/) | BA Tool frontend pages |
| [ProjectSourceCode/sprints/](ProjectSourceCode/sprints/) | Sprint PRDs / WALKTHROUGH documents |
| [prd_generator-backup.sql](prd_generator-backup.sql) | Custom-format Postgres dump (~83 MB) — restore with `pg_restore` |
| [BACKLOG.md](BACKLOG.md) | Top-level product backlog |

---

## 14. Sanity Checklist

Before raising "it doesn't work", confirm all of these:

- [ ] `node -v` shows 20.x and `python --version` shows 3.12.x
- [ ] PostgreSQL 16 is running and `prd_generator` DB exists
- [ ] Three `.env` files are populated with **real** values (especially `OPENAI_API_KEY`)
- [ ] `npm install` completed without errors in **both** `backend/` and `frontend/`
- [ ] `npx prisma generate` ran successfully (look for `query-engine-windows` files inside `node_modules/.prisma/client/`)
- [ ] All three services log a "started"/"ready" line on the expected port
- [ ] <http://localhost:4000/health> returns 200
- [ ] <http://localhost:5000/health> returns 200
- [ ] <http://localhost:3000/ba-tool> renders the BA Tool landing page
