# Security Rules

---

## Mandatory Security Checklist

Before committing any code:

- [ ] No hardcoded secrets, API keys, passwords, or tokens
- [ ] All user inputs validated via DTOs with class-validator
- [ ] SQL injection prevented (parameterized queries via Knex/Objection)
- [ ] Authentication enforced on all protected routes (`@HasScopes` or `@UseGuards(JwtGuard)`)
- [ ] Authorization verified — ownership checks where data belongs to a specific user
- [ ] Rate limiting applied to all sensitive endpoints
- [ ] Error messages do not leak internal data (stack traces, raw DB errors, file paths)
- [ ] Passwords hashed with bcrypt before storage
- [ ] Tokens never logged or stored in plain text

---

## Secret Management

```typescript
// WRONG: hardcoded secret
const secret = 'my-super-secret-key-12345';

// CORRECT: read from typed config
const secret = this.configService.get<string>('auth.secret');
```

**Rules:**
- All secrets in `.env` files — never committed to version control
- `.env.example` committed with placeholder values only (never real values)
- All `process.env.*` reads happen exclusively inside `config/*.ts` loaders
- Application code accesses config only via `ConfigService` or `AppConfig.get()`
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) for production secrets
- Rotate any secret that may have been accidentally exposed immediately

---

## Authentication

### JWT Implementation

```typescript
// JwtGuard validates all of these in order:
// 1. Token signature          — using auth.secret from config
// 2. Token expiration         — rejects expired tokens
// 3. Token issue time         — rejects tokens issued before user.lastLoginAt
//    (prevents reuse of old tokens after logout or password change)
// 4. User status              — rejects inactive or suspended users

@HasScopes('<domain>/updateProfile')
@Patch('/profile')
async updateProfile(@Req() req: Request, @Dto() inputs: UpdateProfileDto) {
  // req.user is populated by JwtGuard after all validations pass
  return this.profileService.update(req.user, inputs);
}
```

### Token Configuration
- **Access token:** short-lived — configure via `JWT_LIFETIME` env var (e.g., `1h`)
- **Refresh token:** longer-lived — configure via `REFRESH_TOKEN_LIFETIME` (e.g., `7d`)
- **Storage:** `httpOnly` cookies + `Authorization` header (both supported)
- **Invalidation:** on logout or password change, update `user.lastLoginAt` to the current time

---

## Authorization

### Scope-Based RBAC

```typescript
// Apply to any endpoint needing both authentication and a specific permission
// Scope format: '<domain>/<action>' — e.g., 'reports/export', 'users/manage'
@HasScopes('<domain>/read')
@Get('/<resources>')
async listResources() { ... }

// Admin-only endpoint
@HasScopes('admin/manageUsers')
@Delete('/users/:uuid')
async deleteUser() { ... }

// Publicly accessible — no authentication required
@IsPublic()
@Get('/health')
async health() { ... }
```

### Resource Ownership Checks

Always verify the authenticated user owns or has access to the requested resource:

```typescript
async updateRecord(user: IUserModel, recordUuid: string, payload: UpdateDto): Promise<XxxModel> {
  const record = await this.xxxRepo.firstWhere({ uuid: recordUuid });
  if (!record) {
    throw new NotFoundException('Record not found');
  }
  // Ownership check — prevents horizontal privilege escalation
  if (record.userId !== user.id) {
    throw new ForbiddenException('You do not have access to this record');
  }
  return this.xxxRepo.update(record, payload);
}
```

---

## Input Validation

```typescript
export class CreateResourceDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(10000)
  description: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;
}
```

**Rules:**
- Validate at controller boundary — not inside services or repositories
- Use `@MaxLength()` on all string fields to prevent oversized payloads
- Use `@IsUUID()` for any resource ID coming from a client
- Use `@IsUrl()`, `@IsEmail()`, `@IsMobilePhone()` for format-constrained fields
- Use `@IsUnique()` for fields that must be unique in the database
- Whitelist valid fields — strip or reject unknown fields

---

## Password Security

```typescript
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash on creation / update
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// Verify on login
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

- Never store plain text passwords — always bcrypt hash
- Never log passwords, even hashed ones
- Never return password fields in API responses — exclude in Transformer
- Enforce minimum complexity via DTO validation (`@IsStrongPassword()`)
- On password change: update `lastLoginAt` to invalidate all existing sessions

---

## Rate Limiting

Protect sensitive endpoints from brute-force attacks:

```typescript
// Global default applies automatically via ThrottlerModule
@Post('/login')
async login() { ... }

// Override for higher-risk routes
@Throttle({ default: { limit: 5, ttl: 60000 } })   // 5 req/min
@Post('/login')
async login() { ... }

@Throttle({ default: { limit: 3, ttl: 300000 } })  // 3 req/5 min
@Post('/forgot-password')
async forgotPassword() { ... }

@Throttle({ default: { limit: 3, ttl: 900000 } })  // 3 req/15 min
@Post('/verify-otp')
async verifyOtp() { ... }
```

---

## File Upload Security

```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Post('/upload')
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
async upload(@UploadedFile() file: Express.Multer.File, @Res() res: Response) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new GenericException('File type not allowed');
  }
  return res.success(await this.fileService.upload(file));
}
```

- Validate MIME type — do not rely on file extension alone
- Store user-uploaded files in S3 with private ACL by default
- Generate pre-signed URLs for temporary access (set short expiry)
- Never serve user-uploaded content from the same origin as the API

---

## CORS Configuration

```typescript
// RestServer reads CORS origins from config/app.ts
// .env (production)
CORS_ORIGINS=https://app.<your-domain>.com,https://admin.<your-domain>.com

// .env (local development only — never production)
CORS_ORIGINS=*
```

Never use wildcard `*` for production CORS origins.

---

## Security Headers

Applied automatically by `RestServer` via Helmet:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`

---

## Logging Security Rules

```typescript
// WRONG: logging sensitive data
this.logger.log(`Login attempt: email=${email}, password=${password}`);

// CORRECT: log safe, non-PII identifiers only
this.logger.log('User authenticated', { userId: user.uuid, action: 'login' });
this.logger.warn('Failed login attempt', { action: 'login', ip: req.ip });
```

- Never log passwords, tokens, API keys, or secrets
- Never log full request bodies for auth or payment endpoints
- Use `uuid` as the identifier for users in logs — not email or phone number
- Use structured key-value pairs, not interpolated strings

---

## Do Not

- Assume client-side validation is sufficient — always validate server-side
- Return internal error details (stack traces, raw DB errors, file paths) in production responses
- Store plain text passwords or access tokens in the database
- Use `Math.random()` for security-critical operations — use `crypto.randomBytes()`
- Disable HTTPS or skip certificate validation for outbound requests
- Use default credentials or weak secrets in any environment
- Allow user-supplied data to reach `eval()`, `exec()`, or dynamic `require()`
