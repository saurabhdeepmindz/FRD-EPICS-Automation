---
name: SKILL-07-create-ftc
description: Produce a Functional Test Case (FTC) artifact — canonical sections + a tree of structured test cases with OWASP tags, SQL setup/verify, Playwright hints, and complete RTM traceability (FRD → EPIC → User Story → SubTask → [LLD] → TC). Optional after EPIC. Single artifact covers both black-box and white-box cases (tagged per TC). Web OWASP Top 10 + LLM OWASP Top 10 coverage.
---

# SKILL-07 — Functional Test Cases

> Generate a complete FTC document and a tree of structured test cases that a tester can execute directly and a Playwright/Cypress/pytest codegen skill can later transform into runnable specs. Covers functional, integration, security (OWASP Web + LLM), and (when LLD is linked) white-box class/method-level assertions. Every test case carries full RTM traceability.

## 1. When to run

| Prerequisite | Minimum state |
|---|---|
| Module | EPICS_COMPLETE (same bar as LLD; stories + subtasks optional) |
| LLD    | Optional — if present AND `includeLldReferences=true` in config, generated TCs cite LLD classes/methods and are tagged `scope: white_box` |
| Narrative | Optional (architect/tester can describe additional cases not in EPICs) |

## 2. Context Management — What This Skill Receives

The orchestrator's `assembleSkill07Context` assembles:

```
projectMeta               { projectName, projectCode, productName, clientName, sqlDialect }
moduleId / moduleName / packageName
frdHandoffPacket          full FRD content (required)
epicHandoffPacket         full EPIC content (required)
storyHandoffPacket        full User Story content (optional)
subtaskHandoffPacket      full SubTask content (optional)
lldContext                resolved LLD sections + pseudo-file paths (present only when config.includeLldReferences=true AND an LLD artifact exists)
rtmRows                   [{ featureId, featureName, epicId, storyId, subtaskId, ... }]
tbdFutureRegistry         [{ registryId, integrationName, classification, ... }]

ftcConfig {
  testingFrameworks    string[]         // multi-select. e.g. ["Playwright", "pytest", "k6"]. Empty = AI picks defaults.
  testTypes            string[]         // multi-select. e.g. ["Functional", "Integration", "UI", "Security"]. Empty = emit ALL types.
  coverageTarget       "Smoke" | "Regression" | "Full" | null   // depth (not type)
  owaspWebEnabled      boolean
  owaspLlmEnabled      boolean
  excludedOwaspWeb     string[]         // e.g. ["A10"]
  excludedOwaspLlm     string[]         // e.g. ["LLM08"]
  includeLldReferences boolean
  ftcTemplate          { name, content } | null
  customNotes          string | null
}

architectNarrative       optional free-form narrative + attachment extracts
narrativeMode            "additional" | "from-scratch"   (present when architectNarrative is)
```

Any field that is `null` / missing means the architect did not pick it. Fill the gap using testing best practices and document under **Applied Best-Practice Defaults**.

### Narrative handling

- **`narrativeMode: "additional"`** — narrative is *extra* cases on top of EPIC/story/subtask-derived coverage. Produce the standard FTC artifact; weave narrative items into the right canonical section.
- **`narrativeMode: "from-scratch"`** — EPIC/story/subtask packets are intentionally omitted. Drive TCs from `architectNarrative` + stacks + templates only. Still produce the canonical sections; fold exotic cases under Integration Test Cases.
- In BOTH modes, record narrative-originated assumptions under **Applied Best-Practice Defaults** with `(Source: Architect Narrative)` so reviewers can trace decisions.

## 3. Output Contract — What You Must Produce

Your response is a **single Markdown document** divided into two parts:

1. **FTC Document** — the canonical sections below in order.
2. **Test Case Appendix** — every test case as a fenced block with the strict TC-INDEX format (see §5). The backend parser reads these into `BaTestCase` rows.

### Canonical sections (use `## ` headings, in this exact order)

```
1.  Summary
2.  Test Strategy (framework, coverage target, scope split black-box vs white-box, SQL dialect)
3.  Test Environment & Dependencies
4.  Master Data Setup (one consolidated SQL block for shared fixtures; use project sqlDialect)
5.  Test Cases Index (grouped by EPIC → feature → story → subtask; every TC-id appears here)
6.  Functional Test Cases
7.  Integration Test Cases (consolidated view; individual cases numbered TC-XXX-INT-NN)
8.  White-Box Test Cases (LLD-linked; OMIT THIS SECTION when lldContext is absent)
9.  OWASP Web Top 10 Coverage Matrix (table: A01–A10 × covered? × TC-ids)
10. OWASP LLM Top 10 Coverage Matrix (only when the module has AI content; table: LLM01–LLM10 × covered? × TC-ids)
11. Data Cleanup / Teardown (SQL + notes)
12. Playwright Automation Readiness (per-TC summary hints count + any gaps for automation)
13. Traceability Summary (FRD → EPIC → US → ST → LLD → TC)
14. Open Questions / TBD-Future Reconciliation
15. Applied Best-Practice Defaults
```

Under §6, §7, §8, embed test cases in the strict TC block format below. The full content of each TC (steps, expected, SQL, OWASP tag, traceability) must also appear in the Test Case Appendix so the parser can pick it up in one pass.

## 4. Test Case ID Rules

Every scenario group MUST contain **both positive and negative** test cases. Typical ratio: at least 1 positive happy-path TC + 3–5 negative TCs per scenario (empty input / invalid format / duplicate / boundary / expired-link style cases). If a scenario truly has no meaningful negative path, note that under §15 Applied Best-Practice Defaults with reasoning.

### ID conventions

- **TC-001**, **TC-002**, … for *positive* top-level cases (happy-path, positive equivalence classes).
- **Neg_TC-005**, **Neg_TC-006**, … for *negative* top-level cases (invalid inputs, error states, boundary violations). The `Neg_` prefix is formatting-only — `testKind=negative` in the fenced-block header is the authoritative signal.
- **TC-001-INT-01**, **TC-001-INT-02** for integration sub-cases under a parent TC.
- IDs are sequential across the whole artifact — do not reset per EPIC. A single numeric sequence is shared between `TC-` and `Neg_TC-` (e.g. TC-001, TC-002, Neg_TC-003, Neg_TC-004, TC-005, …).
- Never reuse an ID. Never invent FRD/EPIC/US/ST IDs — cite only those present in the context.

### Scenario grouping

Within each EPIC, group TCs by **scenarioGroup** — a short human-readable scenario label matching the CSV convention. Examples:
- `"Signup – Starter Plan"`
- `"Signup – Firm Plan (Payment)"`
- `"Login"`
- `"Forgot Password"`
- `"New Conversation – Start Research"`
- `"Admin Dashboard – SLA Breach Banner"`

Section §5 Test Cases Index renders as EPIC → scenarioGroup → (positive block, negative block).

## 5. Test Case Block Format (strict)

Every TC in the document AND every TC in the appendix MUST use this fenced block:

```tc id=TC-001 parent= scope=black_box testKind=positive category=Functional priority=P1 owasp= isIntegrationTest=false sprintId= executionStatus=NOT_RUN scenarioGroup=Login
title: User logs in with valid credentials
linkedFeatureIds: F-01-02
linkedEpicIds: EPIC-01
linkedStoryIds: US-001
linkedSubtaskIds: ST-US001-BE-03
linkedPseudoFileIds:
linkedLldArtifactId:
tags: auth, smoke
supportingDocs: Login Flow Screenshot, Auth API trace
defectIds:

### Test Data
Email: alice@acme.com
Password: P@ssw0rd!

### Pre Condition
- Tenant `acme` exists
- User `alice@acme.com` has been registered with password `P@ssw0rd!`
- Application URL is accessible

### E2E Flow
Launch URL → Login → Enter credentials → Submit → Dashboard loaded

### Test Steps
1. Launch the application URL.
2. Click **Login**.
3. Enter email `alice@acme.com`.
4. Enter password `P@ssw0rd!`.
5. Click **Sign in**.

### Expected
- Browser redirects to `/dashboard`.
- Session cookie `sid` is set with `HttpOnly; Secure; SameSite=Lax`.
- User greeting shows "Welcome, Alice".

### Post Validation
- Audit row with `action='LOGIN_SUCCESS', actor='alice@acme.com'` appears in `audit_events` within 10 s.
- No `LOGIN_FAILURE` row is written.
- `/api/auth/login` returned 200 with a JWT that expires in 24 h.
- No verification email is re-sent (only for initial signup).

### SQL Setup
INSERT INTO tenants (id, name) VALUES ('acme', 'Acme Corp');
INSERT INTO users (id, email, password_hash, tenant_id)
VALUES ('u1', 'alice@acme.com', '$argon2id$...', 'acme');

### SQL Verify
SELECT COUNT(*) = 1 AS ok
FROM audit_events
WHERE actor = 'alice@acme.com' AND action = 'LOGIN_SUCCESS' AND created_at > NOW() - INTERVAL '1 minute';

### Playwright Hint
await page.goto('/login');
await page.getByLabel('Email').fill('alice@acme.com');
await page.getByLabel('Password').fill('P@ssw0rd!');
await page.getByRole('button', { name: 'Sign in' }).click();
await expect(page).toHaveURL(/\/dashboard/);

### Developer Hints
AuthService.login(email, password) returns { userId, tenantId, sessionId } on success.
Unit test: mocked user repo; verify password_hash check and audit row emission.
```

### Field rules

Header attributes (first line of the fenced block):

- **scope** — `black_box` (default) or `white_box`. Use `white_box` when the TC asserts against an internal class/method from the LLD.
- **testKind** — `positive` (default) | `negative` | `edge`. The authoritative kind signal. `Neg_` ID prefix is formatting only.
- **category** — one of: `Functional`, `Integration`, `Security`, `Data`, `UI`, `Performance`, `Accessibility`, `Regression`, `Smoke`.
- **priority** — `P0` / `P1` / `P2`.
- **owasp** — blank, or one of: `A01`…`A10` (Web 2021), `LLM01`…`LLM10` (GenAI 2025).
- **parent** — blank, unless `isIntegrationTest=true`, in which case the parent TC id.
- **isIntegrationTest** — `true` when the TC verifies an external system interaction (HTTP call to dependency, Kafka publish, DB-trigger cascade). Child IDs use `-INT-NN` suffix.
- **sprintId** — leave blank. Populated post-generation by sprint planning (v2).
- **executionStatus** — always `NOT_RUN` at generation time. QA flips to PASS / FAIL / BLOCKED / SKIPPED during execution (v2).
- **scenarioGroup** — required. See §4 for examples.

Header key-value lines (one per line, before the first `###`):

- **title** — required. One sentence, past tense or imperative, no compound "and" titles.
- **linkedFeatureIds / linkedEpicIds / linkedStoryIds / linkedSubtaskIds** — comma-separated. Cite only IDs present in the context.
- **linkedPseudoFileIds / linkedLldArtifactId** — populated only for white-box TCs when `lldContext` is present.
- **tags** — comma-separated short labels (auth, smoke, boundary, regression, …).
- **supportingDocs** — comma-separated names of screenshots / traces / documents expected as evidence. Leave blank when none apply.
- **defectIds** — leave blank at generation time. QA populates during execution.

Sub-section blocks (each `### Heading` followed by content):

- **Test Data** — concrete inputs (emails, phone numbers, card numbers, passwords). Required unless the TC is intrinsically data-free (e.g. "click cancel"). For negative TCs, list the *invalid* values being tested.
- **Pre Condition** — numbered or bulleted list of system state the test assumes.
- **E2E Flow** — a single arrow-summary line matching the CSV convention: `Launch URL → Action 1 → Action 2 → Outcome`. Keep under 80 chars.
- **Test Steps** — detailed numbered steps. Each step is imperative and testable.
- **Expected** — step-level expected outcome visible to the user (screen transitions, messages, UI state).
- **Post Validation** — cross-cutting checks beyond the UI: emails received, DB rows written, audit entries, API responses, background jobs triggered. Distinct from `Expected` — these are the *consequences* of the test, not what the user sees immediately.
- **Supporting Documents** — list of supplementary evidence names.
- **SQL Setup / SQL Verify** — dialect from `projectMeta.sqlDialect`. Keep idiomatic; avoid proprietary extensions unless the dialect requires them. Skip for pure-UI validation tests.
- **Playwright Hint** — 5–15 lines of realistic code. Skip for pure backend / SQL-only TCs. See framework routing below for multi-framework projects.
- **Developer Hints** — 1–3 sentences for the future v5.1 TDD codegen skill. Skip for pure end-to-end UI cases.

### Framework routing (multi-select)

`ftcConfig.testingFrameworks[]` may contain several entries. Route per-TC hint blocks to the framework(s) that match the TC's `category`:

| TC `category` | Eligible frameworks (first match wins) |
|---|---|
| `UI` | Playwright → Cypress → Selenium |
| `Functional` (backend) | pytest → JUnit → TestNG |
| `Integration` | REST-assured → Postman → pytest (requests) |
| `Performance` | k6 → JMeter |
| `Security` | use whatever the TC's category-of-origin maps to above |
| `Accessibility`, `Data`, `API` | use the same mapping as their closest primary category (UI for Accessibility, Functional for Data, Integration for API) |

Rules:

- If `testingFrameworks` is empty, fall back to defaults: Playwright for UI/accessibility, pytest for Functional/Data/API, REST-assured for Integration, k6 for Performance.
- If multiple eligible frameworks are selected for a TC's category, emit a **single** primary hint block (first match), and mention the alternatives in one line at the end of the hint: `// Also executable in: Cypress, Selenium`.
- When `Manual` is the only selection, SKIP the Playwright Hint block entirely for every TC — output pure manual-execution steps.
- Header sub-section name stays `### Playwright Hint` when the chosen framework is Playwright. For other frameworks use `### pytest Hint`, `### JUnit Hint`, `### k6 Script`, etc. — the backend parser stores whichever comes first under `playwrightHint` (the field is framework-agnostic despite the legacy name).

### Test types filter

`ftcConfig.testTypes[]` (e.g. `["Functional", "Integration", "UI", "Security"]`) filters which TC categories you emit.

- If `testTypes` is empty, emit ALL categories (pre-multi-select behaviour).
- If non-empty, generate TCs ONLY for the listed categories. Do NOT fabricate a TC for a category not in the list.
- OWASP Security TCs follow `testTypes` filtering too: if `Security` is not selected, do not emit OWASP-tagged TCs even if the category is enabled on the module (list them under §9/§10 matrices as "Excluded by test-types filter").
- Log any categories excluded by this filter under §15 Applied Best-Practice Defaults so reviewers understand what was skipped and why.

## 6. OWASP Coverage Rules

### Web Top 10 2021

| Code | Theme |
|---|---|
| A01 | Broken Access Control |
| A02 | Cryptographic Failures |
| A03 | Injection |
| A04 | Insecure Design |
| A05 | Security Misconfiguration |
| A06 | Vulnerable and Outdated Components |
| A07 | Identification and Authentication Failures |
| A08 | Software and Data Integrity Failures |
| A09 | Security Logging and Monitoring Failures |
| A10 | Server-Side Request Forgery |

Emit at least one TC for each enabled (not excluded) category **when applicable to the module**. If a category does not apply (e.g. no SSRF surface), do NOT invent a test — instead, list the category in §9 coverage matrix as "N/A — <one-line reason>".

### LLM Top 10 2025 (only when the module has AI content)

Trigger: `lldContext` indicates an AI stack (LangChain / LangGraph / PyTorch / `ai-service/` pseudo files), OR `architectNarrative` explicitly describes LLM/agent behaviour.

| Code | Theme |
|---|---|
| LLM01 | Prompt Injection |
| LLM02 | Sensitive Information Disclosure |
| LLM03 | Supply Chain |
| LLM04 | Data and Model Poisoning |
| LLM05 | Improper Output Handling |
| LLM06 | Excessive Agency |
| LLM07 | System Prompt Leakage |
| LLM08 | Vector and Embedding Weaknesses |
| LLM09 | Misinformation |
| LLM10 | Unbounded Consumption |

High-severity defaults for AI modules — produce at least one TC each for LLM01, LLM02, LLM05, LLM06 unless the architect has excluded them.

## 7. Hard rules

- Produce the canonical sections in the exact order above.
- Every TC in the document MUST also appear in the Test Case Appendix (last section of the document).
- Never hallucinate IDs. Cite only IDs present in the context.
- Preserve every `TBD-Future` marker from upstream verbatim — do not silently resolve them; reference them under §14 Open Questions.
- SQL dialect matches `projectMeta.sqlDialect`. When the dialect is null, default to PostgreSQL and note the default applied.
- Output only Markdown — no JSON handoff packet (the parser reads TC blocks directly).
- Do NOT wrap the entire response in a markdown code fence.
- Keep each TC focused on ONE acceptance criterion; multi-AC TCs should be split.

## 8. Test Case Appendix (final section of the document)

After all canonical sections, end the document with:

```
## Test Case Appendix

<every TC block from the document above, in the same strict format, in TC-id order>
```

The appendix is the canonical source of truth for the parser. If a TC appears only in §6/§7/§8 but not in the appendix, it will be silently dropped.

## 9. Applied Best-Practice Defaults — what to list

Whenever you pick a default because the architect did not (testing framework, SQL dialect, OWASP category exclusion rationale, TBD-Future handling choice, white-box vs black-box scope for a TC), add a bullet to §15 with:
- what decision was made,
- the default chosen,
- the rationale (one sentence),
- optionally `(Source: Architect Narrative)` when the narrative pointed to the choice.
