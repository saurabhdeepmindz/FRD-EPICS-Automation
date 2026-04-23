# Architect Console — Tech-Stack Seed Data

This directory bundles the well-known tech-stack values that the Architect Console's dropdowns come pre-populated with on a fresh install of the BA Tool.

## Contract

- **Consumed by:** `BaMasterDataService.onModuleInit()` in the Nest backend.
- **Behaviour:** On boot, for each of the 8 categories below, the service checks if any `BaMasterDataEntry` rows exist for `scope = GLOBAL` + that category. If not, it reads the matching JSON file here and inserts the `entries` array as GLOBAL rows.
- **Re-seeding:** The Architect Console's `Reset category from bundle` action is a no-op against anything other than these 8 tech-stack categories. Template categories (Project Structure, Backend Template, Frontend Template, LLD Template, Coding Guidelines) are **not** bundled — Architects upload them through the UI.

## Files

| File | Category |
|---|---|
| `frontend-stack.json` | FRONTEND_STACK |
| `backend-stack.json`  | BACKEND_STACK |
| `database.json`       | DATABASE |
| `streaming.json`      | STREAMING |
| `caching.json`        | CACHING |
| `storage.json`        | STORAGE |
| `cloud.json`          | CLOUD |
| `architecture.json`   | ARCHITECTURE |

## File format

```json
{
  "$schema-version": 1,
  "category": "<BaMasterDataCategory enum value>",
  "description": "<human-readable note>",
  "entries": [
    { "name": "<display name>", "value": "<canonical id>", "description": "<short explanation>" }
  ]
}
```

- `name` is what the Architect sees in the dropdown.
- `value` is the canonical machine id passed to downstream skills (kept for future ergonomics — e.g. matching coding guidelines by `value=nestjs`).
- `description` is optional and shown in the row's detail view.

## Extending

To add a new tech-stack entry globally, edit the JSON file, then run **Reset category from bundle** in the Architect Console. Project-scoped entries will be preserved.

To add an entirely new category, update the `BaMasterDataCategory` Prisma enum, add a matching JSON file here, and update the seed loader's category list.
