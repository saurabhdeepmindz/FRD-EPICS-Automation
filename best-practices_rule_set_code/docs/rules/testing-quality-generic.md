# Testing & Code Quality Rules

---

## Minimum Coverage: 80%

Required test types for all non-trivial code:

| Test Type | Target | Framework |
|-----------|--------|-----------|
| **Unit Tests** | Service methods, utilities, transformers | Jest |
| **Integration Tests** | Controllers, repositories, event flows | Jest + Supertest |
| **E2E Tests** | Critical user flows (signup, login, core features) | Jest + Supertest |

---

## Test-Driven Development (TDD)

Mandatory workflow for new features and bug fixes:

```
1. RED:     Write the test — it must FAIL
2. GREEN:   Write minimal implementation to pass
3. IMPROVE: Refactor while keeping tests passing
4. VERIFY:  Run coverage — must be ≥ 80% for changed files
```

Do not write implementation code before the failing test exists.

---

## File Structure

Test files live alongside source files with a `.spec.ts` suffix:

```
apps/<app>/src/
├── controllers/
│   └── auth.controller.spec.ts        # Controller integration tests
├── services/
│   ├── auth/
│   │   └── auth.service.spec.ts       # Service unit tests
│   └── core/
│       └── token.service.spec.ts

libs/<lib>/src/
├── repositories/
│   └── <entity>/
│       └── database.spec.ts           # Repository unit tests
└── services/
    └── index.spec.ts
```

---

## Unit Tests — Services

Test all service methods, covering:
- Happy path
- Edge cases (empty results, zero values, optional fields absent)
- Error cases (not found, forbidden, duplicate, validation failures)

```typescript
// services/auth/auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockEventEmitter: jest.Mocked<DomainEventEmitter>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: createMockUserRepo() },
        { provide: TokenService, useValue: createMockTokenService() },
        { provide: DomainEventEmitter, useValue: createMockEventEmitter() },
      ],
    }).compile();

    service = module.get(AuthService);
    mockUserRepo = module.get(UserRepository);
    mockTokenService = module.get(TokenService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should create user, assign role, emit event, and return token', async () => {
      const inputs = buildCreateUserDto();
      mockUserRepo.create.mockResolvedValue(buildUserModel({ id: 1 }));
      mockTokenService.generate.mockResolvedValue('jwt-token');

      const result = await service.register(inputs);

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: inputs.email }),
      );
      expect(mockEventEmitter.userRegistered).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      );
      expect(result.token).toBe('jwt-token');
    });

    it('should throw when user already exists', async () => {
      mockUserRepo.create.mockRejectedValue(new Error('duplicate key value'));
      await expect(service.register(buildCreateUserDto())).rejects.toThrow();
    });

    it('should throw NotFoundException when default role does not exist', async () => {
      mockUserRepo.firstWhere.mockResolvedValue(undefined);
      await expect(service.register(buildCreateUserDto())).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## Integration Tests — Controllers

Test the full request lifecycle using Supertest:

```typescript
// controllers/auth.controller.spec.ts
describe('POST /auth/<role>/signup', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UserRepository)
      .useValue(createMockUserRepo())
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('should register a new user and return 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/<role>/signup')
      .send(buildValidSignupPayload())
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('accessToken');
  });

  it('should return 400 when email is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/<role>/signup')
      .send({ ...buildValidSignupPayload(), email: 'not-an-email' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
      ]),
    );
  });

  it('should return 429 after exceeding rate limit', async () => {
    for (let i = 0; i < 11; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/<role>/signup')
        .send({});
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/<role>/signup')
      .send({})
      .expect(429);
  });
});
```

---

## Test Factories / Builders

Create factory functions for test data to avoid duplication across test files:

```typescript
// tests/factories/user.factory.ts
export function buildUserModel(overrides: Partial<IUserModel> = {}): IUserModel {
  return {
    id: 1,
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userType: UserType.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: false,
    preferences: {},
    meta: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function buildCreateUserDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
  return {
    firstName: 'Jane',
    lastName: 'Smith',
    email: `test+${Date.now()}@example.com`,
    password: 'SecurePass123!',
    ...overrides,
  };
}

export function buildValidSignupPayload() {
  return buildCreateUserDto();
}
```

> Add project-specific factory functions here for your domain entities.

---

## Mocking Guidelines

```typescript
// Mock repositories — implement all methods used by the service under test
function createMockUserRepo(): jest.Mocked<Partial<UserRepository>> {
  return {
    all: jest.fn(),
    firstWhere: jest.fn(),
    getWhere: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn((fn) => fn({})),
  } as unknown as jest.Mocked<UserRepository>;
}

// Mock external service modules
jest.mock('@aws-sdk/client-ses');
jest.mock('@aws-sdk/client-s3');
jest.mock('@sentry/node');
```

**Rules:**
- Mock all external services (AWS, email, third-party APIs) in unit and integration tests
- Use a real database for repository-level integration tests (test database, not mocks)
- Never mock the class under test — test it directly
- Reset all mocks between tests: `jest.clearAllMocks()` in `beforeEach`
- Do not use `jest.resetModules()` unless absolutely required — it slows test runs

---

## Coverage Requirements

```json
// jest configuration in package.json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

Run: `npm run test:cov`

**Files requiring > 80% coverage:**
- All service files
- All repository files
- All transformer files
- All guard files

**Files excluded from coverage:**
- `main.ts` bootstrap files
- `module.ts` configuration files
- Migration files
- Type definition files (`*.d.ts`)
- Factory / test helper files

---

## Code Quality Standards

### Functions
- Maximum 50 lines per function
- Single responsibility — one thing, done well
- Prefer pure functions (same input → same output, no side effects)

### Files
- Maximum 800 lines
- 200–400 lines typical
- Single domain responsibility per file

### Nesting
- Maximum 4 levels of indentation
- Extract deeply nested logic into named helper functions

### TypeScript
- No `any` types — always define proper interfaces or use `unknown`
- No `as any` casts — fix the type properly
- Use `readonly` for properties that should not change after construction
- Prefer `interface` over `type` for object shapes

---

## Linting & Formatting

```bash
npm run lint          # Check for lint errors
npm run lint -- --fix # Auto-fix lint errors
npm run format        # Prettier-format all TypeScript files
```

Pre-commit hooks (Husky + lint-staged) automatically format staged `.ts` files on commit.

---

## Do Not

- Add major logic without tests
- Create brittle tests tied to implementation details — test behaviour, not internals
- Call live external APIs in normal test flows — always mock them
- Use `test.only` or `it.only` in committed code
- Use `test.skip` without a comment explaining why
- Test private methods directly — test through the public interface
- Use `setTimeout` or `setInterval` in tests — mock time-dependent behaviour
