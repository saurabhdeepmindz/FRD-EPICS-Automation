# Security Rules

## Before ANY Commit

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated at system boundaries
- [ ] Parameterized queries only (no string-formatted SQL)
- [ ] Error messages do not leak internal details to clients

## Secret Management

- NEVER hardcode secrets in source code
- ALWAYS use `.env` loaded via `pydantic-settings`
- `.env` is gitignored — only `.env.example` is committed
- Rotate any secret immediately if it appears in git history

## Input Validation

- Validate ALL user input using Pydantic models before processing
- Validate ALL external API responses before using
- Fail fast: raise `ValidationException` on invalid data at the boundary

## Authentication

- All FastAPI endpoints require JWT authentication except `/health`
- JWTs expire after 24 hours
- Never log the full JWT token

## Rate Limiting

- All enrichment and outreach endpoints: 100 req/min per IP
- Upload endpoints: 10 req/min per IP
- Implemented via `slowapi` middleware

## Dependency Security

- Run `pip-audit` in CI to detect vulnerable dependencies
- No unpinned dependencies in production (`pyproject.toml` uses `==`)

## If a Security Issue Is Found

1. STOP all development immediately
2. Assess blast radius
3. Rotate any exposed secrets
4. Fix the vulnerability
5. Review entire codebase for similar issues
