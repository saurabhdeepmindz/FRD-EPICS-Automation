"""
Project Structure (§17) — structured model.

Produces the full §17: the monorepo OVERVIEW (grouped folders/modules that
replace the legacy tile diagram) plus the prescriptive Template-v3 detail —
§17 intro + three principles, §17.1 Backend, §17.2 Frontend, §17.3 AI Agent,
§17.4 Naming conventions — all adapted to THIS project's stack and modules.
Grounded in the project's PRD/FRD/HLD; anything inferred/missing → `gaps`.
"""

PROJECT_STRUCTURE_SYSTEM_PROMPT = """You are an expert software architect. From the project's PRD/FRD/HLD, produce a PROJECT STRUCTURE (§17) as a STRICT JSON object: a monorepo overview PLUS prescriptive Template-v3 folder structures and conventions, adapted to THIS project's actual stack, modules and datastore. Ground everything in the given project; do not invent technologies not implied by the context. Be honest: if the project has no AI agent, mark that sub-section not-applicable rather than inventing one.

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
  "intro": "string",
  "principles": [{"principle":"string","how":"string"}],
  "backend": {
    "stack": "string",
    "intro": "string",
    "rootTree": "string",
    "perModuleTree": "string",
    "folderReference": [{"folder":"string","poc":true,"purpose":"string"}]
  },
  "frontend": {
    "stack": "string",
    "intro": "string",
    "rootTree": "string",
    "componentRule": [{"scope":"string","location":"string","rule":"string"}],
    "promotionRule": "string"
  },
  "aiAgent": {
    "applicable": true,
    "note": "string",
    "stack": "string",
    "rootTree": "string",
    "folderResponsibilities": [{"folder":"string","poc":true,"purpose":"string"}],
    "runtimeInteraction": "string"
  },
  "namingConventions": [{"concern":"string","convention":"string","examples":"string"}],
  "gaps": ["string"]
}

Field rules:
- `groups` (the overview tiles): one group per area, short `items` (fit a small tile) reflecting THIS project's real frontend areas, backend modules, DB tables, shared packages and config files. Derive <framework>/<db> from the project's stack.
- `intro`: 1–2 sentences — that §17 instantiates the architecture as concrete, prescriptive folder layouts so every module looks the same.
- `principles`: the guiding principles (Principle | How it shows up). Typically: Consistency over cleverness; Convention over configuration; POC velocity / scale-ready; Must-have asterisk convention. Adapt wording to the project.
- TREES (`rootTree`, `perModuleTree`, frontend `rootTree`, aiAgent `rootTree`): multi-line plain-text folder trees using tree characters. Each line: tree prefix (├──, │, └──) + path, optionally followed by '  # short note'. Follow the reference HLD Template-v3 layout (apps/[module]-api · config/ · database/ · lib/ · per-module src/ with interface/controller/service/workflow/policy/repository/entity/dto/mapper/event/guard/test; frontend feature-first with app/ thin routes + features/[module]/ + components/ui|shared|layout) BUT substitute the project's real module names (e.g. auth, kyc, listing, booking, payment for Luggage Room) and adapt the stack. Keep trees focused (~25–45 lines each); use the project's actual modules as examples.
- `backend.folderReference` (§ Folder reference table): one row per backend per-module folder (interface/, controller/, service/, workflow/, policy/, repository/, entity/, dto/, mapper/, event/, exception/, guard/, test/) with `poc` (true = POC must-have) and a `purpose` line.
- `frontend.componentRule` (3-tier shared-component rule): rows for App-wide primitive (components/ui/), Cross-feature shared (components/shared/), Feature-specific (features/[module]/components/). `frontend.promotionRule`: 1–2 sentences on how a component is promoted from feature to shared.
- `aiAgent`: if the project HAS an AI/LLM agent, set applicable=true and fill `stack` (e.g. Python · FastAPI · LangGraph), `rootTree` (tool/ graph/ prompt/ client/ schema/ guard/ exception/ test/), `folderResponsibilities` (one row per folder with poc + purpose), and `runtimeInteraction` (a short plain-text flow, e.g. "Frontend ─WS→ Orchestrator ─intent→ [module]-ai-agent → tool/* ─HTTP→ Domain Service"). If NO AI agent, set applicable=false, note="Not applicable — <reason>", and leave stack/rootTree/runtimeInteraction empty strings and folderResponsibilities [].
- `namingConventions`: the cross-stack conventions (Concern | Convention | Examples) — module names (kebab-case), backend service folders, backend file naming, class names, interfaces, DI tokens, frontend folders/components/hooks/api/pages, AI-agent files/graphs/classes/prompts. Adapt examples to the project's modules.
- `gaps`: anything inferred, defaulted, or missing from the docs."""


def build_project_structure_user_message(product_name: str, prd_context: str, hld_context: str) -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:8000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:5000]}")
    parts.append("\n## Task\nReturn the Project Structure JSON described above, grounded in this project.")
    return "\n".join(parts)
