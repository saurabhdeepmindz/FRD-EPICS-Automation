# H1 — Input Sanitisation Audit

**Date:** 2026-04-24
**Scope:** Systematic review of every `@Body()` and `@Param()` surface in the BA-Tool NestJS backend, with targeted fixes for the highest-impact gaps.

## Pre-audit state

- `ValidationPipe` is wired globally in `main.ts` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Good defaults.
- **But**: the pipe only acts on DTO **classes** annotated with `class-validator` decorators. Most endpoints added between v3 and v4 (Phase 2a, Sprint entity, Defect CRUD, RCA) used plain TypeScript **interfaces** as their `@Body()` type. ValidationPipe had nothing to validate against and arbitrary JSON reached the service.
- The v1 DTOs (project, module, flow, master-data, update-project, update-screen, update-subtask-section, refine-section) were correctly using DTO classes and were already hardened.

## Endpoints hardened in H1

All seven endpoints now use DTO classes with `class-validator` decorators. Any request with extra properties is rejected (400) before hitting the service; all text fields are length-capped; all enum-like fields (status, severity, sprint status) are pinned to a literal set.

| Endpoint | Method | DTO | Notes |
|---|---|---|---|
| `/api/ba/test-cases/:id/runs` | POST | `CreateTestRunDto` | Status enum, 4 KB note cap, nested `DefectOnRunDto` for optional defect sub-form |
| `/api/ba/test-cases/bulk-runs` | POST | `BulkCreateTestRunDto` | UUID-array validation + 200-TC cap (matches server-side cap) |
| `/api/ba/test-cases/:id/defects` | POST | `CreateDefectDto` | Standalone "Open defect" flow |
| `/api/ba/defects/:id` | PATCH | `UpdateDefectDto` | All fields optional, status pinned to 6-value enum |
| `/api/ba/defects/:id/rca` | POST | `SaveTesterRcaDto` | `contributingFactors` capped at 20 items |
| `/api/ba/projects/:id/sprints` | POST | `CreateSprintDto` | `sprintCode`/`name` required, ISO-8601 dates |
| `/api/ba/sprints/:id` | PATCH | `UpdateSprintDto` | All fields optional; same enum + date rules |

## What specifically changed at the wire

Before H1 (example — bulk runs):

```jsonc
// POST /api/ba/test-cases/bulk-runs
{
  "testCaseIds": ["<uuid>", "<uuid>", …],
  "status": "PASS",
  "notes": "<any length>",
  "rmRf": "gotcha",                  // accepted silently
  "status2": "DROP TABLE users"      // accepted silently (ignored later, but reached service)
}
```

After H1:

```text
POST /api/ba/test-cases/bulk-runs
→ 400 Bad Request (property rmRf should not exist, status2 should not exist)
```

And for the fields that ARE expected:

- `testCaseIds` — must be a non-empty array of **UUIDs**, max length **200** (matches the server-side cap)
- `status` — must be one of `PASS | FAIL | BLOCKED | SKIPPED`
- `notes` — string, max **4000 chars** (prevents DoS via giant payloads)
- `executor` / `environment` / `sprintId` — strings, max 100 chars
- `sprintDbId` — must be a valid UUID
- `executedAt` — must be ISO-8601

## Items reviewed and found already-safe

- **Attachment uploads** (LLD narrative, FTC narrative, Defect evidence)
  - `FileSizeBytes` hard-capped at **30 MB total per artifact** in `MAX_TOTAL_ATTACHMENT_BYTES` / `MAX_DEFECT_ATTACHMENT_BYTES`
  - `FilesInterceptor({ limits: { fileSize } })` also applied at the Multer layer
  - `DiskAttachmentStorage.put()` sanitises each path segment separately and uses `path.dirname` with `{ recursive: true }` — path-traversal safe
  - Stored file name on disk is a generated UUID; user-supplied `originalname` is kept only in the DB row and never joined back into a filesystem path
- **AI prompt construction** (RCA, gap-checks, AC coverage)
  - All user-supplied text is framed inside explicit `sections.append(…)` blocks with labels before going to OpenAI
  - Python side enforces `max_length` Pydantic bounds on every text field (e.g. `defectTitle: str = Field(..., max_length=300)`)
  - The new `evidenceContext` field is capped per-attachment (2 KB) and total (8 KB) in `BaRcaService.buildEvidenceSnippet`
- **SQL injection** — every query goes through Prisma parameterised helpers. No raw SQL except the one-off backfill migration (run out-of-band by the developer).
- **NoSQL injection** — N/A, Postgres only.
- **CORS** — pinned to `CORS_ORIGINS` env var, default `http://localhost:3000`. No wildcard.
- **Body size** — Express default (100 KB) applies; attachment uploads use Multer streaming, not JSON body.
- **Path traversal** — reviewed `DiskAttachmentStorage` per above.
- **SSRF** — the one outbound HTTP call from backend is to the Python AI service at `AI_SERVICE_URL`. URL is env-controlled; no user-supplied URLs are ever fetched by the backend.

## Items explicitly deferred (outside H1 scope)

- **Rate limiting** on AI-backed endpoints — [E5, DEFERRED]. One user can currently drain the OpenAI quota.
- **Virus scan on uploads** — [H2, P3]. We accept + store raw bytes; no ClamAV or equivalent.
- **Secret rotation** — [H3, P3]. `OPENAI_API_KEY`, `DATABASE_URL` still in `.env`; no Vault/KMS integration.
- **Pen-test hardening** — [H4, P3]. No automated AppSec scan has been run.
- **Authentication / authorisation** — [E1, E2, DEFERRED]. Every request is anonymous right now.

## Verification

- `npx tsc --noEmit` clean in backend after the changes (5 controllers touched, 2 new DTO files added).
- Existing happy-path payloads still succeed (structural compat: DTO classes match the prior interface shapes).
- Extra-property rejection confirmed by `forbidNonWhitelisted: true` (global setting, unchanged).

## What reviewers should watch next

- When **F2 (tracker integrations)** lands, the `externalRef` field will start carrying tracker URLs. Add URL-scheme validation at that point (only allow `https://`, reject `javascript:` / `data:` / etc.).
- When **E2 (RBAC)** lands, DTOs should gain `@IsIn([ownProjectIds])` style checks — but those need a session context that doesn't exist yet.
- If `BaPseudoFile.editedContent` ever gets rendered as raw HTML anywhere (currently rendered via the sanitising Markdown renderer), escape + sanitise before render.

---
Generated as part of backlog item **H1** in `BACKLOG.md`.
