"""
E2E-Flow generation prompts (Track R).

Produces project-scoped, cross-module, role-based customer journeys as a
decision-graph, plus 4 Mermaid diagrams per flow. Mirrors the structure of the
SKILL-E2E-FLOW skill file. Output is strict JSON (response_format=json_object).
"""

import json

E2E_DIAGRAM_KEYS = ["functional", "classMethod", "dbEntities", "integrations"]

E2E_FLOW_SYSTEM_PROMPT = """You are a senior solution architect. From a project's FRD and its modules/screens,
define CROSS-MODULE, role-based, executable END-TO-END customer journeys (E2E flows).

These are NOT module-scoped click-throughs. Each flow MUST span >= 2 modules and capture a
real business process a person or system performs across the product.

Use a DECISION-GRAPH, not a flat list:
- Every step is a node with a nodeType: START | STEP | DECISION | JOIN | END.
- Model branches explicitly via nextStepIds + branchLabels (e.g. OTP valid/invalid,
  payment success/fail, email confirmed/not).
- Tag every step with the module it runs in (moduleRef = the module's moduleId like "MOD-02"),
  the actor (role), the screen (screenId, if UI), and a layer: UI | API | DB | Integration.
- When an external service is involved (payment, SMS/OTP, email, auth), set integrationRef
  to the vendor and add it to the integrations list.

Reference journeys to emulate (pick what fits the product; do not invent unrelated ones):
1. E-commerce checkout: select -> cart -> auth -> payment(gateway) -> inventory(DB) -> order id + email.
2. Banking fund transfer: login -> transfer -> OTP(SMS) -> ledger(DB) -> balance. Branch on OTP.
3. API booking CRUD: POST/GET/PATCH/DELETE chain where each output feeds the next; final GET = 404.
4. 16-step signup: launch -> T&C -> plan -> form -> submit -> verification email -> confirm link ->
   set password -> success. Branch on email confirmed.

Surface DESIGN GAPS: if the FRD/screens don't reveal which module/class owns a step, emit a
gaps[] entry instead of inventing detail.

Emit up to 4 Mermaid diagrams per flow under mermaidDiagrams:
- functional: a BRANCHED flowchart of the journey (roles, steps, decisions).
- classMethod: a classDiagram of the classes/methods (may be sparse pre-LLD).
- dbEntities: an erDiagram of DB entities the journey touches.
- integrations: a flowchart of 3rd-party integrations on the path.
Keep Mermaid syntactically valid and simple. If you cannot fill a diagram yet, omit that key.

Return STRICT JSON ONLY, no prose, matching exactly:
{
  "flows": [{
    "flowKey": "E2E-...", "flowName": "...", "journeyType": "UI|API|MIXED",
    "primaryRole": "...", "secondaryRoles": ["..."], "spannedModuleRefs": ["MOD-01","MOD-02"],
    "steps": [{
      "stepId": "S01", "sequenceNum": 1, "nodeType": "START|STEP|DECISION|JOIN|END",
      "nextStepIds": ["S02"], "branchLabels": {"S02":"..."},
      "moduleRef": "MOD-01", "screenId": "SCR-..", "role": "..", "triggerLabel": "..",
      "outcome": "..", "condition": "..", "layer": "UI|API|DB|Integration", "integrationRef": ".."
    }]
  }],
  "integrations": [{"vendorName": "..", "category": "PAYMENT|SMS_OTP|EMAIL|AUTH|WEBHOOK|OTHER", "endpoint": "..", "authScheme": ".."}],
  "gaps": [{"question": ".."}]
}
"""


def build_e2e_flow_user_message(frd_sections: dict, modules: list, config: dict | None, product_name: str) -> str:
    """Assemble the user message: product, FRD, modules+screens, and config hints."""
    parts: list[str] = []
    parts.append(f"# Product: {product_name or '(unnamed)'}")

    frd = frd_sections.get("6") if isinstance(frd_sections, dict) else None
    parts.append("\n## Functional Requirements (FRD — PRD section 6)")
    parts.append(json.dumps(frd, indent=2)[:12000] if frd is not None else "_FRD section not found._")

    parts.append("\n## Other PRD sections (for context)")
    parts.append(json.dumps(frd_sections, indent=2)[:8000])

    parts.append("\n## Modules and screens (use moduleId as moduleRef)")
    for m in modules or []:
        screens = ", ".join(f"{s.get('screenId')}:{s.get('title')}" for s in (m.get("screens") or [])) or "(no screens)"
        parts.append(f"- {m.get('moduleId')} · {m.get('moduleName')} — screens: {screens}")

    if config:
        parts.append("\n## Config hints")
        if config.get("referenceJourneys"):
            parts.append(f"- Reference journeys requested: {', '.join(config['referenceJourneys'])}")
        if config.get("defaultRoles"):
            parts.append(f"- Default roles/personas: {', '.join(config['defaultRoles'])}")
        if config.get("narrative"):
            parts.append(f"- Narrative: {config['narrative'][:2000]}")

    parts.append("\nProduce the E2E flows as strict JSON per the schema. Each flow MUST span >= 2 modules.")
    return "\n".join(parts)
