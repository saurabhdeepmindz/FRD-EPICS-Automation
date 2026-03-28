# PRD Generator — Source Code

A web application that guides Business Analysts through creating a complete 22-section Product Requirements Document with AI-powered field suggestions.

## Architecture

```
ProjectSourceCode/
├── frontend/        Next.js 14 (App Router) + Tailwind CSS + shadcn/ui  → :3000
├── backend/         NestJS REST API + Prisma ORM                        → :4000
├── ai-service/      Python FastAPI + OpenAI GPT-4.5                     → :5000
└── docker-compose.yml
```

## Prerequisites

| Tool | Version |
|------|---------|
| Docker Desktop | ≥ 4.x |
| Docker Compose | ≥ 2.x |
| Node.js | ≥ 20.x (local dev only) |
| Python | ≥ 3.12 (local dev only) |

## Quick Start (Docker — recommended)

```bash
# 1. Clone the repo
git clone <repo-url>
cd ProjectSourceCode

# 2. Copy and configure environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env

# 3. Add your OpenAI API key to ai-service/.env
#    OPENAI_API_KEY=sk-your-key-here

# 4. Start all services
docker-compose up --build

# Services will be available at:
#   Frontend  → http://localhost:3000
#   Backend   → http://localhost:4000
#   AI Service→ http://localhost:5000
#   Postgres  → localhost:5432
```

## Local Development (without Docker)

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma db push   # requires PostgreSQL running
npm run start:dev    # http://localhost:4000
```

### AI Service
```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env → add OPENAI_API_KEY
uvicorn main:app --reload --port 5000
```

## Running Tests

```bash
# Structural validation (no deps needed)
node --test tests/task1-structure.test.mjs

# Frontend unit tests
cd frontend && npm test

# Backend unit tests
cd backend && npm test

# E2E tests (requires services running)
cd frontend && npm run test:e2e
```

## Environment Variables

| Service | File | Key Variables |
|---------|------|--------------|
| frontend | `.env.local` | `NEXT_PUBLIC_API_URL` |
| backend | `.env` | `DATABASE_URL`, `AI_SERVICE_URL`, `CORS_ORIGINS` |
| ai-service | `.env` | `OPENAI_API_KEY`, `OPENAI_MODEL` |

> **Security:** Never commit `.env` files. Only `.env.example` files (with no real secrets) are committed.

## Sprint Progress

| Sprint | Status | Description |
|--------|--------|-------------|
| v1 | In Progress | Core scaffold, 22-section PRD form, AI suggestions, PDF export |

Sprint details: `sprints/v1/PRD.md` and `sprints/v1/TASKS.md`
