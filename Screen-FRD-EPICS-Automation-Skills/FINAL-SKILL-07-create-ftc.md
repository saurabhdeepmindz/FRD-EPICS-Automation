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
  testingFramework     "Playwright" | "Cypress" | "Selenium" | "pytest" | "JUnit" | "TestNG" | "Manual" | null
  coverageTarget       "Smoke" | "Regression" | "Full" | null
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

- **TC-001**, **TC-002**, … for top-level cases (functional + white-box + security).
- **TC-001-INT-01**, **TC-001-INT-02** for integration sub-cases under a parent TC.
- IDs are sequential across the whole artifact — do not reset per EPIC.
- Never reuse an ID. Never invent FRD/EPIC/US/ST IDs — cite only those present in the context.

## 5. Test Case Block Format (strict)

Every TC in the document AND every TC in the appendix MUST use this fenced block:

```tc id=TC-001 parent= scope=black_box category=Functional priority=P1 owasp= isIntegrationTest=false
title: User logs in with valid credentials
linkedFeatureIds: F-01-02
linkedEpicIds: EPIC-01
linkedStoryIds: US-001
linkedSubtaskIds: ST-US001-BE-03
linkedPseudoFileIds:
linkedLldArtifactId:
tags: auth, smoke

### Preconditions
- Tenant `acme` exists
- User `alice@acme.com` has been registered with password `P@ssw0rd!`

### Steps
1. Navigate to `/login`.
2. Enter email `alice@acme.com`.
3. Enter password `P@ssw0rd!`.
4. Click "Sign in".

### Expected
- Browser redirects to `/dashboard`.
- Session cookie `sid` is set with `HttpOnly; Secure; SameSite=Lax`.
- Audit row with `action='LOGIN_SUCCESS', actor='alice@acme.com'` appears in `audit_events`.

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

- **scope** — `black_box` (default) or `white_box`. Use `white_box` when the TC asserts against an internal class/method from the LLD.
- **category** — one of: `Functional`, `Integration`, `Security`, `Data`, `UI`, `Performance`, `Accessibility`, `Regression`, `Smoke`.
- **priority** — `P0` / `P1` / `P2`.
- **owasp** — blank, or one of: `A01`, `A02`, `A03`, `A04`, `A05`, `A06`, `A07`, `A08`, `A09`, `A10` (Web 2021), `LLM01`, `LLM02`, `LLM03`, `LLM04`, `LLM05`, `LLM06`, `LLM07`, `LLM08`, `LLM09`, `LLM10` (GenAI 2025).
- **parent** — blank, unless `isIntegrationTest=true`, in which case the parent TC id.
- **isIntegrationTest** — `true` when the TC verifies an external system interaction (HTTP call to dependency, Kafka publish, DB-trigger cascade). Child IDs use `-INT-NN` suffix.
- **SQL sections** use the dialect from `projectMeta.sqlDialect`. Keep them dialect-idiomatic; avoid proprietary extensions unless the dialect requires them.
- **Playwright Hint** — write realistic code snippets; `await page.goto(...)`, `expect(...)`. Keep them short (5–15 lines). Skip for pure backend / SQL-only cases.
- **Developer Hints** — 1–3 sentences about the unit-level assertions a TDD codegen skill should emit from this TC. Skip if purely end-to-end UI.

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
