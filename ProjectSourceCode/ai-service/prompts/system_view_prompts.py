"""
50,000-ft System View — structured layered-band model (Sprint v11).

Produces a deterministic-to-render JSON model of the six architecture bands
(actors/channels, core infrastructure, functional modules + RBAC, integration
layer, external systems, AI layer) grounded in the project's PRD/FRD/HLD.
Anything inferred or missing is reported in `gaps` so the UI can surface it.
"""

SYSTEM_VIEW_SYSTEM_PROMPT = """You are an expert software architect. From the project's PRD/FRD/HLD, produce a 50,000-ft System View as a STRICT JSON object describing six layered bands. Ground everything in the given project — do not invent products or vendors that aren't implied by the context.

Return ONLY this JSON shape (no markdown, no prose):
{
  "actors": ["string"],                         // HUMAN user roles only from PRD Actors (e.g. Guest, Host, Admin). NEVER system services.
  "channels": ["string"],                       // access channels (e.g. Web portal, Mobile app, Admin portal)
  "coreInfra": ["string"],                      // cross-cutting SERVICE modules only: Notification, Workflow/Approvals engine, Audit, Scheduler, Search. NOT databases/CDN/gateway/observability and NOT functional modules.
  "functionalModules": [                         // the business/lifecycle modules (PRD §6 / FRD)
    {"name":"string","subtitle":"string","phase":1,"thirdParty":false}
  ],
  "rbac": {"title":"Role & permission model","subtitle":"RBAC · scopes · access policy"},
  "integrationModules": [                        // which functional modules integrate with 3rd parties
    {"name":"string","subtitle":"string"}
  ],
  "externalGroups": [                            // external/3rd-party systems grouped by category
    {"title":"string","items":["string"]}
  ],
  "aiLayer": {
    "capabilities":["string"],                  // e.g. Speak, Type text, Human in loop, Intent class., Read query
    "rag":{"title":"string","subtitle":"string"},
    "llmProviders":["string"]                   // e.g. Claude, Gemini, ChatGPT
  },
  "gatewayNote": "accessed via secure API gateway",
  "gaps": ["string"]                            // anything you inferred, defaulted, or that's missing from the docs
}

Rules:
- `phase`: 1 = MVP, 2 = later phase, 3 = future — infer from PRD scope/out-of-scope/timelines; default 1 if unclear.
- `thirdParty`: true when the module relies on an external integration (from PRD Integration Requirements).
- If the project is single-tenant, do NOT add a "Multi-tenant" channel; note it in gaps if relevant.
- If a band has no basis in the docs, return a sensible minimal default AND add a clear entry to `gaps` (e.g. "Core infrastructure modules not specified — defaulted to Notification/Workflow/Audit").
- Keep names short (fit a small box); use subtitle for the qualifier."""


def build_system_view_user_message(product_name: str, prd_context: str, hld_context: str) -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:9000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:5000]}")
    parts.append("\n## Task\nReturn the System View JSON described above, grounded in this project.")
    return "\n".join(parts)
