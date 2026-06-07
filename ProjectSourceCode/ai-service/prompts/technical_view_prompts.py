"""
Layered Technical View — structured layered-band model (§4 of the reference HLD).

Produces a deterministic-to-render JSON model of the standard technical layers
(Users & Roles → Presentation → Edge/Gateway → Auth → Application Services →
AI/ML → Event Bus → Data → Platform/DevOps), grounded in the project's
PRD/FRD/HLD. Each layer carries the components that live in it, a detailed
"what lives here" paragraph, and a "key technology / pattern" string — exactly
the columns of the reference HLD §4.1 table. Layers with no basis in the project
are marked not-applicable with an out-of-scope reason (e.g. AI/ML for a product
with no AI features). Anything inferred/missing is reported in `gaps`.
"""

TECHNICAL_VIEW_SYSTEM_PROMPT = """You are an expert software architect. From the project's PRD/FRD/HLD, produce a LAYERED TECHNICAL VIEW as a STRICT JSON object describing the standard technical layers (top-down, following request flow). Ground everything in the given project — do not invent technologies or components that aren't implied by the context.

Return EXACTLY these nine layers, in this order, each with the same keys (no extra layers, no missing layers):

{
  "layers": [
    {"key":"usersRoles",     "name":"Users & Roles",                  "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"presentation",   "name":"Presentation / Client Layer",    "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"edgeGateway",    "name":"Edge · API Gateway · Security",  "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"authz",          "name":"Authentication & Authorization", "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"appServices",    "name":"Application Services",            "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"aiml",           "name":"AI / ML Layer",                  "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"eventBus",       "name":"Event Bus & Async Messaging",    "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"dataLayer",      "name":"Data Layer",                     "applicable":true, "outOfScope":"", "nodes":["string"], "whatLivesHere":"string", "keyTech":"string"},
    {"key":"platformDevops", "name":"Platform · DevOps · Observability","applicable":true,"outOfScope":"","nodes":["string"], "whatLivesHere":"string", "keyTech":"string"}
  ],
  "gaps": ["string"]
}

Field rules:
- `nodes`: the concrete components that live in this layer FOR THIS PROJECT (the boxes shown in the diagram). Keep each name short (fits a small box), e.g. for Presentation: "Web App", "Admin Portal"; for Data Layer: "PostgreSQL", "Redis", "S3". 3–7 nodes typical.
- `whatLivesHere`: a DETAILED 2–4 sentence description of what this layer is and what lives in it for THIS project — this fills the "What lives here" column of the reference HLD §4.1 table. Be concrete and project-specific (name the actual components, roles, responsibilities); do NOT write generic textbook text and do NOT just restate the node labels.
- `keyTech`: a concise "key technology / pattern" string for this layer (the §4.1 third column), e.g. "Next.js 14 · responsive web · CDN edge cache" or "PostgreSQL · Row-Level Security · Redis cache".
- `applicable` / `outOfScope`: set `applicable=false` and give a one-line `outOfScope` reason for any layer the project genuinely does not need — e.g. AI/ML for a product with no AI/ML features, or Event Bus for a simple synchronous CRUD app with no async/eventing. When not applicable, leave `nodes` empty, set `whatLivesHere` to the out-of-scope reason, and `keyTech` to "—". Do NOT force-fit a layer that isn't in the project.
- Be decisive but grounded: most web apps DO have Users & Roles, Presentation, Edge/Gateway, Auth, Application Services, Data, and Platform/DevOps. AI/ML and Event Bus are the ones most often out of scope.
- `gaps`: anything you inferred, defaulted, or that's missing from the docs."""


def build_technical_view_user_message(product_name: str, prd_context: str, hld_context: str) -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:9000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:5000]}")
    parts.append("\n## Task\nReturn the Layered Technical View JSON described above, grounded in this project.")
    return "\n".join(parts)
