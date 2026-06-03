---
name: e2e-flow
skill_id: SKILL-E2E-FLOW
scope: project
prerequisite: FRD_COMPLETE (project rollup — every in-scope module has reached FRD)
position: after FRD, before EPICs
status_machine: excluded (project-scoped + optional, like LLD/FTC)
produces: BaE2eFlow + BaE2eFlowStep (decision-graph) + 4 Mermaid diagrams
---

# SKILL-E2E-FLOW — Create Cross-Module End-to-End Flows

## Purpose

Define **project-scoped, role-based, executable customer journeys that span multiple
modules** — the gap left by today's module-scoped artifacts. An E2E flow is created
**before EPICs** and is **elaborated downstream** at each stage (EPIC → User Story →
Sub-Task → LLD → FTC → WTC), expanding top-to-bottom to show exactly which modules,
features, classes/methods, DB entities and 3rd-party integrations implement each step —
so design gaps surface early.

## Inputs

- **FRD sections** (project PRD+FRD, section 6 = Functional Requirements).
- **Modules + screens** — every module's `moduleId`, `moduleName`, and screen list
  (so steps can reference real screens and cross module boundaries).
- **Config** (`BaE2eFlowConfig`): `referenceJourneys`, `defaultRoles`, free-text `narrative`.
- Existing module **navigation/click-through flows** (optional) — stitch into journeys.

## Reference journeys (few-shot exemplars)

1. **E-commerce checkout:** product select → add to cart → auth (login/guest) →
   checkout & payment (gateway) → inventory check (ERP/DB) → order ID + email confirm.
2. **Banking fund transfer:** login → transfer → **OTP (SMS gateway)** →
   ledger debit/credit (DB) → balance refresh. *Branches on OTP valid/invalid.*
3. **API booking CRUD chain:** POST /bookings (201 + id) → GET → PATCH → DELETE →
   final GET (404). Output of each call feeds the next.
4. **16-step signup:** launch → home → T&C → plan select → signup form → enter data →
   submit → "almost done" → verification email → open email → confirm link →
   set password → enter+re-enter → set → success/activated. *Branches on email confirmed.*

## Output (strict JSON)

```json
{
  "flows": [{
    "flowKey": "E2E-FUND-TRANSFER",
    "flowName": "Banking Fund Transfer",
    "journeyType": "UI | API | MIXED",
    "primaryRole": "Customer",
    "secondaryRoles": ["OTP Service", "Ledger Service"],
    "spannedModuleRefs": ["MOD-02", "MOD-05"],
    "steps": [{
      "stepId": "S03",
      "sequenceNum": 3,
      "nodeType": "DECISION | STEP | START | JOIN | END",
      "nextStepIds": ["S04", "S03b"],
      "branchLabels": { "S04": "OTP valid", "S03b": "OTP invalid → retry" },
      "moduleRef": "MOD-02",
      "screenId": "SCR-OTP",
      "role": "Customer",
      "triggerLabel": "Enter OTP",
      "outcome": "Authorize transfer",
      "condition": "if OTP valid",
      "layer": "UI | API | DB | Integration",
      "integrationRef": "Twilio"
    }],
    "mermaidDiagrams": {
      "functional": "flowchart TD ...   (branched journey)",
      "classMethod": "classDiagram ...  (filled downstream from LLD)",
      "dbEntities": "erDiagram ...      (entities the journey touches)",
      "integrations": "flowchart LR ... (payment/OTP/email/auth)"
    }
  }],
  "integrations": [{ "vendorName": "Twilio", "category": "SMS_OTP", "endpoint": "...", "authScheme": "..." }],
  "gaps": [{ "question": "Which module owns the ledger write for the transfer step?" }]
}
```

## Rules

- **Decision-graph, not a list.** Use `nodeType` + `nextStepIds` + `branchLabels` for every
  success/failure branch (OTP valid/invalid, payment success/fail, email confirmed/not).
- **Cross-module by design.** Each step carries the `moduleRef` it executes in; a flow MUST
  span ≥ 2 modules (else it's just a module nav flow — out of scope here).
- **Layer every step** (UI/API/DB/Integration) so downstream FTC can compose layered
  assertions (UI `playwrightHint` + API + DB `sqlSetup/sqlVerify` + `postValidation`).
- **Surface gaps.** If FRD/screens don't reveal who owns a step (e.g. the ledger write),
  emit a `gaps` entry rather than inventing detail.
- **4 diagrams.** Always emit `functional`; emit the others when the inputs allow (class/DB
  detail fills in downstream during elaboration).

## Downstream elaboration (carried forward)

Each later stage appends to the step's `elaborationByStage` (one key per stage):
`EPIC` (realizing epics) → `USER_STORY` (stories + acceptance criteria) →
`SUBTASK` (sourceFile/class/method, integration points) → `LLD` (concrete classes,
methods, DB entities, pseudo files) → `FTC` (black-box layered TCs) →
`WTC` (white-box TCs per method in the call chain). An empty slot = a flagged design gap.
