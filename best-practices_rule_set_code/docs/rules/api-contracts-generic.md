# API Contracts & Versioning

---

## Standard Response Envelope

Every API response must use the standard envelope. No exceptions.

### Success Response
```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": { ... }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "lastPage": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "User-friendly error message",
  "data": null,
  "errors": [
    { "field": "email", "message": "Email is already taken" }
  ]
}
```

### NestJS Implementation
```typescript
// In controller
return res.success(data, 'Profile updated successfully');
return res.success(await this.paginate(items, meta));

// Errors are thrown as exceptions — ExceptionFilter formats them
throw new GenericException('Something went wrong');
throw new NotFoundException('User not found');
throw new ForbiddenException('Access denied');
```

---

## URL Conventions

```
/api/v1/<resource>/<action>
```

| Pattern | Example |
|---------|---------|
| Auth routes | `/api/v1/auth/customer/signup` |
| Resource collection | `/api/v1/users` |
| Single resource | `/api/v1/users/:uuid` |
| Resource action | `/api/v1/users/:uuid/verify-email` |
| Nested resource | `/api/v1/conversations/:uuid/messages` |

**Rules:**
- Always use kebab-case for URL segments
- Always version APIs: `/api/v1/...`
- Use nouns for resources, not verbs (`/users` not `/getUsers`)
- Use HTTP verbs to express action: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

---

## HTTP Methods

| Method | Usage | Body | Idempotent |
|--------|-------|------|------------|
| `GET` | Retrieve resource(s) | None | Yes |
| `POST` | Create resource or trigger action | Required | No |
| `PUT` | Replace entire resource | Required | Yes |
| `PATCH` | Partial update | Required | Yes |
| `DELETE` | Remove resource | None | Yes |

---

## HTTP Status Codes

| Code | When to Use |
|------|------------|
| `200 OK` | Successful GET, PATCH, DELETE |
| `201 Created` | Successful POST that creates a resource |
| `400 Bad Request` | Validation errors, malformed request |
| `401 Unauthorized` | Missing or invalid authentication |
| `403 Forbidden` | Authenticated but not authorized |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate resource (e.g., email taken) |
| `422 Unprocessable Entity` | Semantic validation errors |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |

---

## Query Parameter Conventions

### Pagination
```
GET /api/v1/users?page=1&limit=20
```

### Filtering
```
GET /api/v1/users?status=1&userType=2
```

### Sorting
```
GET /api/v1/users?sortBy=createdAt&sortOrder=desc
```

### Includes (eager loading)
```
GET /api/v1/users/:uuid?include=roles,company
```

### Search
```
GET /api/v1/users?search=john
```

---

## Request Validation

All endpoints receiving user input must validate via DTOs:

```typescript
@Validate(CreateUserDto)
@HashScope('permission')
@Post('/users')
async create(@Dto() inputs: CreateUserDto, @Res() res: Response) {
  const user = await this.userService.create(inputs);
  return res.success(user, 'User created');
}
```

Validation errors are automatically returned as 400 with field-level errors:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "email must be a valid email" },
    { "field": "firstName", "message": "firstName should not be empty" }
  ]
}
```

---

## API Versioning

### Current Version: v1
All endpoints live under `/api/v1/`.

### Adding a New Version
When a breaking change is unavoidable:
1. Create `v2` controllers in a separate directory
2. Register both versions in the module
3. Deprecate v1 endpoints with a response header: `Deprecation: true`
4. Set a sunset date and log v1 usage

### Non-Breaking Changes (allowed in-place)
- Adding new optional response fields
- Adding new optional query parameters
- Adding new endpoints
- Performance improvements

### Breaking Changes (require new version)
- Removing response fields
- Renaming fields
- Changing field types
- Changing required/optional status of request fields
- Changing URL structure

---

## Authentication Headers

```
Authorization: Bearer <accessToken>
```

Or via cookie:
```
Cookie: accessToken=<token>
```

Refresh token endpoint uses:
```
Cookie: refreshToken=<token>
```

---

## Swagger / OpenAPI

All controllers and DTOs must have Swagger decorators:

```typescript
// Controller
@ApiTags('<Domain> Authentication')
@Controller('auth/<role>')
export class AuthController extends RestController { ... }

// Endpoint
@ApiOperation({ summary: 'Register a new user' })
@ApiResponse({ status: 201, description: 'Registration successful' })
@ApiResponse({ status: 400, description: 'Validation failed' })
@Post('/signup')
async register(@Dto() inputs: CreateUserDto) { ... }

// DTO
export class CreateUserDto {
  @ApiProperty({ example: 'Jane', description: 'First name of the user' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;
}
```

Swagger is available at `/api/docs` in development environments only.

---

## Error Handling Contract

Errors must never expose:
- Internal stack traces
- Raw database errors
- File paths or internal module names
- Connection strings or credentials

Errors must always include:
- A user-friendly `message`
- An HTTP status code appropriate to the error type
- Field-level errors when validation fails

---

## Do Not

- Return different response shapes from the same endpoint based on flags
- Return raw Objection.js model objects (use transformers)
- Leave undocumented endpoints in production
- Ship breaking API changes without bumping the version
- Leak internal error details in production responses
