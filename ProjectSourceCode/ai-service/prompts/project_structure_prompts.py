"""
Project Structure (§17) — structured model.

Phase 1 (this file) produces the monorepo OVERVIEW that replaces the legacy
project-structure tile diagram: grouped folders/modules (frontend, backend,
data, shared packages, config) plus AI-agent applicability — grounded in the
project's PRD/FRD/HLD. (The detailed §17.1–17.4 trees/tables are layered on in a
later phase.) Anything inferred/missing is reported in `gaps`.
"""

PROJECT_STRUCTURE_SYSTEM_PROMPT = """You are an expert software architect. From the project's PRD/FRD/HLD, produce a PROJECT STRUCTURE OVERVIEW (§17) as a STRICT JSON object — a monorepo folder/module map grouped by area. Ground everything in the given project (its real modules, stack, datastore, integrations). Do not invent technologies not implied by the context.

Return EXACTLY this shape:
{
  "monorepoLabel": "monorepo root — <Product Name>",
  "groups": [
    {"key":"frontend","title":"apps/frontend/ (<framework>)","kind":"frontend","items":["string"]},
    {"key":"backend", "title":"apps/backend/ (<framework>)", "kind":"backend", "items":["string"]},
    {"key":"data",    "title":"database tables (<db>)",       "kind":"db",      "items":["string"]},
    {"key":"shared",  "title":"packages/ (shared)",           "kind":"shared",  "items":["string"]},
    {"key":"config",  "title":"root config files",            "kind":"config",  "items":["string"]}
  ],
  "aiAgent": {"applicable": true, "note": "string"},
  "gaps": ["string"]
}

Field rules:
- `groups`: one group per area. Keep each `items` entry short (fits a small tile), e.g. frontend: "app/ · routes", "components/", "app/auth/ · route"; backend: "modules/ · controller + service + model + dto", "modules/auth/", "modules/booking/"; data: the actual table names (e.g. "users", "bookings", "payments", "audit_log"); shared: "shared-types/", "ui-components/", "eslint-config/"; config: "package.json", "turbo.json", "docker-compose.yml", ".env.example", "README.md".
- Derive `<framework>` and `<db>` from the project's stack (e.g. "Next.js", "NestJS", "PostgreSQL"). Backend module folders and DB tables MUST reflect THIS project's actual modules/entities (one folder/table per business module).
- `aiAgent`: if the project has an AI/LLM agent component, set `applicable=true` and a one-line `note` (e.g. "apps/ai-agent/ (Python · FastAPI · LangGraph)"). If it has NO AI agent, set `applicable=false` and `note` = "Not applicable — <reason>" (e.g. "no AI agent required"). Do NOT add an AI group when not applicable.
- If a group has no basis in the project (e.g. no shared packages), return a minimal sensible default and note it in `gaps`.
- `gaps`: anything inferred, defaulted, or missing from the docs."""


def build_project_structure_user_message(product_name: str, prd_context: str, hld_context: str) -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:8000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:5000]}")
    parts.append("\n## Task\nReturn the Project Structure overview JSON described above, grounded in this project.")
    return "\n".join(parts)
