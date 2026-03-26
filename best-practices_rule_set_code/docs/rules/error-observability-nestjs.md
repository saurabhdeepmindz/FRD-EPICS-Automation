# Error Handling & Observability

---

## Exception Hierarchy

Use the typed exceptions from `@libs/dmz/exceptions/`. Never throw raw `Error` objects from business logic.

```typescript
// Available exceptions
import {
  GenericException,             // 500 — unexpected server errors
  ForbiddenException,           // 403 — authorization failed
  NotFoundException,            // 404 — resource not found
  InvalidCredentialsException,  // 401 — bad credentials
} from '@libs/dmz';

// Usage
throw new NotFoundException('Record not found');
throw new ForbiddenException('You do not have access to this resource');
throw new InvalidCredentialsException();
throw new GenericException('Something went wrong, please try again');
```

The global `ExceptionFilter` catches all exceptions and formats them into the standard error envelope:
```json
{
  "success": false,
  "message": "Record not found",
  "data": null,
  "statusCode": 404
}
```

---

## Exception Handling in Services

```typescript
// CORRECT: throw typed exceptions with context
async findRecord(uuid: string): Promise<XxxModel> {
  const record = await this.xxxRepo.firstWhere({ uuid });
  if (!record) {
    throw new NotFoundException(`Record with uuid '${uuid}' not found`);
  }
  return record;
}

// CORRECT: catch, log, re-throw or swallow deliberately
async syncWithExternalService(entity: IXxxModel): Promise<void> {
  try {
    await this.externalClient.push(entity);
  } catch (error) {
    this.logger.error('External sync failed', {
      entityId: entity.uuid,
      error: error.message,
    });
    // Do NOT rethrow if this is a non-critical background side effect.
    // DO rethrow wrapped in GenericException if it affects the main flow.
  }
}

// WRONG: silent catch — never do this
async doSomething(): Promise<void> {
  try {
    await this.repo.create(payload);
  } catch (e) {
    // swallowed silently — hides bugs, makes debugging impossible
  }
}
```

---

## Structured Logging

Use NestJS `Logger` for all application logging. Always log structured key-value data,
never concatenated strings.

```typescript
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async register(inputs: CreateUserDto): Promise<RegisterResponse> {
    this.logger.log('User registration started', { email: inputs.email });

    try {
      const user = await this.userRepo.create(payload);
      this.logger.log('User registered successfully', { userId: user.uuid });
      return result;
    } catch (error) {
      this.logger.error('User registration failed', {
        email: inputs.email,
        error: error.message,
      });
      throw new GenericException('Registration failed. Please try again.');
    }
  }
}
```

### Log Levels

| Level | When to Use |
|-------|------------|
| `logger.error()` | Unexpected failures, caught exceptions, failed external calls |
| `logger.warn()` | Recoverable issues, deprecated usage, rate limit hits |
| `logger.log()` | Normal business events (user registered, record created) |
| `logger.debug()` | Detailed flow information for debugging (disable in production) |
| `logger.verbose()` | Very granular tracing (disable in production) |

---

## What to Log

**Always log:**
- Start and completion of significant business operations
- Failed external service calls (with error message, not full stack trace)
- Authentication events (login, logout, failed attempts) — use UUID, not email/phone
- Rate limit violations
- Unexpected exceptions before they propagate

**Never log:**
- Passwords, tokens, API keys, or secrets
- Full request bodies on auth endpoints
- Personally identifiable information (PII) — log UUID references instead
- Full stack traces in production (let Sentry capture them)
- Raw database error messages (wrap in safe user-facing messages)

---

## Sentry Integration

Sentry is configured via `RestServer` and automatically captures unhandled exceptions.

For manual capture with additional context:

```typescript
import * as Sentry from '@sentry/node';

Sentry.captureException(error, {
  extra: {
    entityId: entity.uuid,
    action: '<domain>.<operation>',
  },
  tags: {
    service: '<app-name>',
    environment: process.env.NODE_ENV,
  },
});
```

Configure via environment:
```
SENTRY_DSN=https://xxx@o0.ingest.sentry.io/xxx
```

---

## Health Checks

Every app must expose a health endpoint at `/api/v<n>/health`:

```typescript
@IsPublic()
@Get('/health')
async health(@Res() res: Response): Promise<Response> {
  return res.success({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

Used by:
- Load balancers for routing decisions
- PM2 / container orchestrators for restart policies
- Deployment scripts to confirm successful startup

---

## Request Correlation

Add a correlation ID to every request for tracing across logs:

```typescript
// In a global middleware or RequestGuard
const correlationId = req.headers['x-correlation-id'] ?? randomUUID();
req['correlationId'] = correlationId;
res.setHeader('x-correlation-id', correlationId);

// In service logging
this.logger.log('Processing action', {
  correlationId: req['correlationId'],
  userId: req.user?.uuid,
  action: 'record.update',
});

// Propagate to outbound HTTP calls
headers['x-correlation-id'] = req['correlationId'];
```

---

## Database Error Handling

Translate database-level errors into typed application exceptions inside repositories:

```typescript
async create(payload: CreatePayload): Promise<XxxModel> {
  try {
    return await this.model.query().insertAndFetch(payload);
  } catch (error) {
    if (error.code === '23505') {  // PostgreSQL unique constraint violation
      throw new GenericException('A record with this value already exists');
    }
    this.logger.error('Database insert failed', {
      table: XxxModel.tableName,
      error: error.message,
    });
    throw new GenericException('Failed to save record. Please try again.');
  }
}
```

---

## Do Not

- Swallow exceptions silently (empty `catch` blocks)
- Return raw database errors or stack traces to API consumers
- Log passwords, tokens, or full PII (use UUIDs as references)
- Use error message text for control flow — use error types or codes instead
- Create custom exception classes without extending the `@libs/dmz` base exceptions
- Log at `error` level for expected or user-triggered conditions (use `warn` instead)
