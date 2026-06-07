"""
Detailed Component View — structured model (§5 of the reference HLD).

§5 is the engineering-grade view: the same technical layers as §4, but every
component is annotated with descriptive subtext (chosen tech · dominant pattern ·
integration semantics) and each layer carries a layer-wide pattern banner. It
also produces the §5.2 "How modules show up" table — the application-service
microservices with their dominant concern and the HLD sections where each is
unpacked — and the §5.1 "Reading the detailed view" conventions. Grounded in the
project's PRD/FRD/HLD; anything inferred/missing is reported in `gaps`.
"""

# Valid HLD section keys the §5.2 "where it lives" links may point to.
_SECTION_KEYS = (
    "documentControl, executiveSummary, systemView, technicalLayersView, componentView, "
    "architectureStyleView, deploymentView, architectureStyleDecision, technologyStack, "
    "designPatterns, authDesign, aiLayer, integrations, multiTenancy, nfr, prdCoverage, projectStructure"
)

COMPONENT_VIEW_SYSTEM_PROMPT = f"""You are an expert software architect. From the project's PRD/FRD/HLD, produce a DETAILED COMPONENT VIEW (§5) as a STRICT JSON object. This is the engineering-grade view: the same technical layers as the layered view, but EVERY component is annotated with descriptive subtext, and the application-service microservices are summarised in a table. Ground everything in the given project — do not invent technologies/components not implied by the context.

Return EXACTLY this shape:
{{
  "intro": "string",                              // 1–2 sentence intro: engineering-grade view, when to use it (sprint scoping, integration, security/scale review)
  "layers": [                                     // the nine standard layers, in this order, same keys/names
    {{"key":"usersRoles",     "name":"Users & Roles",                   "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"presentation",   "name":"Presentation / Client Layer",     "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"edgeGateway",    "name":"Edge · API Gateway · Security",   "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"authz",          "name":"Authentication & Authorization",  "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"appServices",    "name":"Application Services",             "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"aiml",           "name":"AI / ML Layer",                   "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"eventBus",       "name":"Event Bus & Async Messaging",     "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"dataLayer",      "name":"Data Layer",                      "applicable":true, "outOfScope":"", "pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}},
    {{"key":"platformDevops", "name":"Platform · DevOps · Observability","applicable":true,"outOfScope":"","pattern":"string", "components":[{{"name":"string","subtext":"string"}}]}}
  ],
  "services": [                                    // §5.2 — the application-service microservices (a subset/expansion of the appServices layer)
    {{"name":"string","dominantConcern":"string","whereKeys":["string"]}}
  ],
  "reading": ["string"],                          // §5.1 — 3–5 short conventions for reading this view, project-specific
  "gaps": ["string"]
}}

Field rules:
- `components[].subtext`: a SHORT descriptive line for each component (≈3–10 words) — the chosen tech, dominant pattern, or integration semantics, e.g. "In-house · 3-stage commit · Saga" or "PostgreSQL · Row-Level Security". This is what makes §5 the "detailed" view; do not just repeat the component name.
- `pattern`: the layer-wide pattern/annotation banner, e.g. for Auth: "Token-based stateless · refresh rotation · step-up MFA"; for Application Services: "DDD bounded contexts · Saga · CQRS · Outbox".
- `applicable`/`outOfScope`: set `applicable=false` + a one-line `outOfScope` reason for any layer the project doesn't need (e.g. AI/ML for a non-AI product, Event Bus for a synchronous CRUD app). When not applicable, leave `components` empty, `pattern`="—".
- `services`: list the project's real application-service microservices (the business/domain services). For each, `dominantConcern` is a 1–2 line subtitle capturing its core concern (e.g. "Pipeline · Scorecards · job-board fan-out · bursty external"). `whereKeys` is 1–3 HLD section keys (from this exact set: {_SECTION_KEYS}) where this service is unpacked — choose the most relevant (e.g. technologyStack, designPatterns, integrations, authDesign, dataLayer→use 'technologyStack', etc.). Use ONLY keys from that set.
- `reading`: 3–5 bullets describing how to read THIS view for THIS project — e.g. that italic subtext under each component names its tech/pattern, that each layer has a pattern banner, that the §5.2 table summarises the services and links to where each is unpacked. Keep them concrete.
- `gaps`: anything inferred, defaulted, or missing from the docs."""


def build_component_view_user_message(product_name: str, prd_context: str, hld_context: str) -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:9000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:6000]}")
    parts.append("\n## Task\nReturn the Detailed Component View JSON described above, grounded in this project.")
    return "\n".join(parts)
