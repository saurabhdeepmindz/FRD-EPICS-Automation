"""
Architecture Style & Design Patterns View — structured model (§6 of the reference HLD).

§6 reframes the same system "by architectural choice": an actors row feeding the
architectural tiers (Presentation → Edge/Gateway → Auth → Application Services →
AI/ML → Event Bus → Data → Platform/DevOps), each tier carrying its pattern
caption. It also produces three tables: §6.1 "What this view tells you that the
others do not" (architectural choices), §6.2 "Design patterns visible in this
view" (patterns by tier), and §6.3 "The 3-Tier Module Pattern" (M1/M2/M3 + O1/O2
archetypes and their forcing functions). Grounded in the project's PRD/FRD/HLD;
anything inferred/missing is reported in `gaps`.
"""

STYLE_VIEW_SYSTEM_PROMPT = """You are an expert software architect. From the project's PRD/FRD/HLD, produce an ARCHITECTURE STYLE & DESIGN PATTERNS VIEW (§6) as a STRICT JSON object. This view reframes the system "by architectural choice" and overlays design patterns. Ground everything in the given project — do not invent technologies/patterns not implied by the context. Be honest for simpler projects: if a choice/tier does not apply, mark it accordingly rather than force-fitting.

Return EXACTLY this shape:
{
  "intro": "string",                              // 1–2 sentence intro: when to use this view (architecture review board, security review, justifying tech choices)
  "actors": ["string"],                           // the RBAC-scoped actor/user types (top row of the diagram)
  "tiers": [                                      // architectural tiers, in this order, same keys/names
    {"key":"presentation",   "name":"Presentation Tier",          "applicable":true, "outOfScope":"", "pattern":"string", "components":[{"name":"string","subtext":"string"}]},
    {"key":"edgeGateway",    "name":"Edge · API Gateway · Security","applicable":true,"outOfScope":"", "pattern":"string", "components":[{"name":"string","subtext":"string"}]},
    {"key":"authz",          "name":"Authentication & Authorization","applicable":true,"outOfScope":"","pattern":"string", "components":[{"name":"string","subtext":"string"}]},
    {"key":"appServices",    "name":"Application Services Tier",    "applicable":true, "outOfScope":"", "pattern":"string", "components":[{"name":"string","subtext":"string"}]},
    {"key":"aiml",           "name":"AI / ML Polyglot Tier",       "applicable":true, "outOfScope":"", "pattern":"string", "components":[{"name":"string","subtext":"string"}]},
    {"key":"eventBus",       "name":"Event Bus & Async Messaging", "applicable":true, "outOfScope":"", "pattern":"string", "components":[{"name":"string","subtext":"string"}]},
    {"key":"dataLayer",      "name":"Data Tier",                   "applicable":true, "outOfScope":"", "pattern":"string", "components":[{"name":"string","subtext":"string"}]},
    {"key":"platformDevops", "name":"Platform · DevOps · Observability","applicable":true,"outOfScope":"","pattern":"string","components":[{"name":"string","subtext":"string"}]}
  ],
  "architecturalChoices": [                       // §6.1 — what this view makes explicit
    {"choice":"string","explicit":"string"}
  ],
  "tierPatterns": [                               // §6.2 — design patterns by tier
    {"tier":"string","patterns":"string"}
  ],
  "modulePattern": {                              // §6.3 — the 3-Tier Module Pattern
    "applicable": true,
    "note": "string",
    "tiers": [
      {"tier":"M1","archetype":"Domain Service","stack":"string","responsibility":"string","mustHave":true},
      {"tier":"M2","archetype":"Policy Engine","stack":"string","responsibility":"string","mustHave":true},
      {"tier":"M3","archetype":"AI Agent","stack":"string","responsibility":"string","mustHave":true},
      {"tier":"O1","archetype":"Background Worker","stack":"string","responsibility":"string","mustHave":false},
      {"tier":"O2","archetype":"Analyzer / Helper","stack":"string","responsibility":"string","mustHave":false}
    ],
    "forcingFunctions": [
      {"service":"string","trigger":"string"}
    ]
  },
  "gaps": ["string"]
}

Field rules:
- `tiers[].pattern`: the tier-wide architectural pattern caption, e.g. Presentation: "Multi-app, polyglot UI (NOT a monolith)"; Edge: "API Gateway · BFF · Rate-limit · Circuit-breaker"; Auth: "Token-based stateless · refresh rotation · step-up MFA".
- `tiers[].components[].subtext`: SHORT (≈3–8 words) tech/pattern note per component.
- `applicable`/`outOfScope`: set `applicable=false` + a one-line reason for any tier the project doesn't need (e.g. AI/ML for a non-AI product, Event Bus for a synchronous app). When not applicable, leave `components` empty and `pattern`="—".
- `architecturalChoices` (§6.1): list the architectural choices THIS project actually makes and what the diagram makes explicit about each. Use the project's reality — if it is a single frontend app, say "Single-app UI" and explain; if it is a monolith, say so. Typical rows to consider (include only those that apply, adapt the wording): multi-app vs single-app UI, microservices vs modular-monolith, polyglot vs single-language, event-driven vs synchronous, cloud-agnostic vs cloud-specific. 3–6 rows.
- `tierPatterns` (§6.2): for each tier that exists, the concrete patterns applied (comma-separated). Mirror the catalogue (API Gateway, BFF, Saga, CQRS, Outbox, Idempotency, Circuit Breaker, Anti-Corruption Layer, Closure-Table, RLS, Effective-Dated, Strategy, Human-in-the-Loop, Event Sourcing, etc.) — but ONLY patterns actually used by this project.
- `modulePattern` (§6.3): if the project is structured as modules/microservices, set `applicable=true`, write a 1–2 sentence `note`, and fill M1 (Domain Service), M2 (Policy Engine), M3 (AI Agent) as must-haves plus O1 (Background Worker) and O2 (Analyzer/Helper) as optionals, each with project-appropriate stack + responsibility; then list 1–3 `forcingFunctions` (when to extract O1/O2 into their own service). If the project is a simple monolith / not module-structured, set `applicable=false`, put the reason in `note`, and leave `tiers`/`forcingFunctions` empty.
- `gaps`: anything inferred, defaulted, or missing from the docs."""


def build_style_view_user_message(product_name: str, prd_context: str, hld_context: str) -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:9000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:6000]}")
    parts.append("\n## Task\nReturn the Architecture Style & Design Patterns View JSON described above, grounded in this project.")
    return "\n".join(parts)
