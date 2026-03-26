# Backend Rules — NestJS / TypeScript

Stack: NestJS 11+, TypeScript 5.3+, Express, class-validator, Objection.js, Knex.

---

## Module Structure

Every feature module in `apps/` and domain lib in `libs/` must follow this layout:

```
<feature>/src/
├── module.ts             # NestJS module: imports, providers, exports
├── main.ts               # Entry point (apps only): calls RestServer.create()
├── controllers/          # HTTP request handlers (thin)
├── services/             # Business logic (domain-grouped subdirs for large apps)
├── dto/                  # Input validation schemas (class-validator)
├── transformers/         # Response shaping (extends Transformer)
├── repositories/         # Data access (in libs) or re-exported from libs
├── models/               # ORM entity definitions
├── guards/               # Custom NestJS guards
├── events/
│   ├── emitters/         # Event emitter classes
│   ├── listeners/        # Event listener classes
│   └── payloads/         # Event payload data structures
├── enums/                # TypeScript enums for this domain
├── interfaces/           # TypeScript interface types
└── constants/            # String/number constants for this domain
```

---

## Controllers

Controllers handle HTTP only. They must stay thin.

**Allowed in controllers:**
- Extracting `@Dto()`, `@Req()`, `@Res()`, `@Param()`, `@Query()`
- Calling one or more service methods
- Calling `this.transform()` / `this.collection()` / `this.paginate()`
- Returning `res.success(data)` or `res.error(message)`

**Not allowed in controllers:**
- Business logic of any kind
- Direct repository or ORM calls
- Complex conditionals or data transformations

```typescript
// CORRECT
@ApiTags('<Domain> Authentication')
@Controller('auth/<role>')
export class AuthController extends RestController {

  constructor(
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
  ) {
    super();
  }

  @IsPublic()
  @Validate(CreateUserDto)
  @Post('/signup')
  async register(@Dto() inputs: CreateUserDto, @Res() res: Response): Promise<Response> {
    const data = await this.authService.register(inputs);
    return res.success(data, 'Registration successful');
  }

  @HasScopes('<domain>/getProfile')
  @Get('/profile')
  async getProfile(@Req() req: Request, @Res() res: Response): Promise<Response> {
    const user = await this.profileService.getProfile(req.user);
    return res.success(
      await this.transform(user, new UserProfileTransformer(), { req }),
    );
  }
}
```

---

## Services

Services contain all business logic. Never call repositories from outside services.

**Rules:**
- One service class per bounded subdomain (e.g., `AuthService`, `TokenService`, `ProfileService`)
- Services may call other services via constructor injection
- Services emit events via emitters — do not call side-effect logic directly
- Services use the Repository API only — no raw ORM or Knex calls

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly usersLib: UsersLibService,
    private readonly tokenService: TokenService,
    private readonly eventEmitter: DomainEventEmitter,
  ) {}

  async register(inputs: CreateUserDto): Promise<RegisterResponse> {
    const role = await this.usersLib.roleRepo.firstWhere({ name: '<default-role>' });
    const user = await this.usersLib.userRepo.create({
      firstName: inputs.firstName,
      email: inputs.email,
      // ...
    });
    await this.usersLib.roleUserRepo.create({ userId: user.id, roleId: role.id });
    const token = await this.tokenService.generate(user);
    this.eventEmitter.userRegistered(user);  // fire-and-forget side effect
    return { user, token };
  }
}
```

---

## DTOs

DTOs are the validated contract between client input and application code.

**Rules:**
- Every DTO property must have at least one `class-validator` decorator
- Use `@Type(() => X)` for type coercion on nested objects or dates
- Group DTOs by domain in `dto/<domain>/index.ts`
- Use `@IsOptional()` for fields that are not required on update

```typescript
// dto/user/index.ts

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  @IsUnique({ table: 'users', column: 'email' })
  email: string;

  @IsNotEmpty()
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsMobilePhone()
  mobileNumber?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsMobilePhone()
  mobileNumber?: string;
}
```

---

## Transformers

Transformers shape data for API responses. They prevent leaking internal model fields.

**Rules:**
- Extend the abstract `Transformer` class from `@libs/dmz`
- Always explicitly list every output field — never spread the raw model
- Flatten nested JSONB fields (e.g., `user.meta.<field>` → top-level field) at this layer
- Support `includes` for lazy-loading relations into responses

```typescript
// transformers/user-profile.transformer.ts
export class UserProfileTransformer extends Transformer {
  async transform(user: IUserModel): Promise<object> {
    return {
      uuid: user.uuid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      userType: user.userType,
      status: user.status,
      // Flatten JSONB preferences
      theme: user.preferences?.theme,
      language: user.preferences?.language,
      // Flatten project-specific JSONB meta fields here
      // e.g.: registrationNumber: user.meta?.registrationNumber,
    };
  }
}
```

---

## Events

Use NestJS EventEmitter for side effects. Never call side-effect logic synchronously in services.

**Pattern:**
1. Service calls `eventEmitter.xxxEvent(payload)` — fire and forget
2. Emitter extends `EventEmitter2` and dispatches strongly-typed payload
3. Listener classes handle one responsibility each (notification / audit log / external sync)

```typescript
// events/payloads/user-registered.payload.ts
export class UserRegisteredPayload {
  constructor(public readonly user: IUserModel) {}
}

// events/emitters/domain-event.emitter.ts
@Injectable()
export class DomainEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  userRegistered(user: IUserModel): void {
    this.eventEmitter.emit('auth.user.registered', new UserRegisteredPayload(user));
  }
}

// events/listeners/notification.listener.ts
@Injectable()
export class NotificationListener {
  constructor(private readonly mailService: MailService) {}

  @OnEvent('auth.user.registered')
  async handleUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    await this.mailService.sendVerificationEmail(payload.user);
  }
}

// events/listeners/audit-log.listener.ts
@Injectable()
export class AuditLogListener {
  constructor(private readonly auditRepo: AuditLogRepository) {}

  @OnEvent('auth.user.registered')
  async handleUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    await this.auditRepo.create({ action: 'user.registered', userId: payload.user.id });
  }
}
```

---

## Guards

Use the provided guards from `@libs/roles-and-permissions`. Only create custom guards
for non-standard authentication scenarios.

| Guard / Decorator | Usage |
|-------------------|-------|
| `JwtGuard` | Validates access JWT, attaches `req.user` |
| `ScopeGuard` | Checks `req.user` has required permission scope |
| `RefreshJwtGuard` | Validates refresh token |
| `GoogleGuard` | Passport OAuth redirect |
| `@IsPublic()` | Bypasses JWT validation entirely |
| `@HasScopes('x/y')` | Applies JwtGuard + ScopeGuard + requires scope `x/y` |

```typescript
// Public endpoint — no auth required
@IsPublic()
@Post('/login')
async login(@Dto() inputs: LoginDto, @Res() res: Response) { ... }

// Protected endpoint — requires JWT + specific scope
@HasScopes('users/manage')
@Get('/users')
async listUsers(@Res() res: Response) { ... }
```

---

## App Bootstrap (main.ts)

All apps bootstrap via the `RestServer` utility from `@libs/dmz`:

```typescript
// apps/<name>/src/main.ts
import { RestServer } from '@libs/dmz';
import { AppModule } from './module';

async function bootstrap() {
  await RestServer.create(AppModule, {
    port: process.env.PORT ?? 3001,
    prefix: 'api/v1',
    enableSwagger: process.env.NODE_ENV !== 'production',
  });
}

bootstrap();
```

`RestServer` automatically applies:
- Global `ExceptionFilter`
- Global `ValidationPipe`
- CORS with configured origins
- Cookie parser
- Body parser (50 MB limit)
- Swagger UI (when enabled)
- Sentry integration

---

## Module Registration

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ load: configs, isGlobal: true }),
    DmzModule,                       // Always import — provides global services
    UsersLibModule,                  // Import the lib module, not individual repos
    RolesAndPermissionsLibModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([...]),  // Rate limiting
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    ProfileService,
    TokenService,
    DomainEventEmitter,
    NotificationListener,
    AuditLogListener,
  ],
})
export class <Feature>ApisModule {}
```

---

## Response Format

All responses must use the standard envelope via `res.success()` or throw typed exceptions:

```typescript
// Success
res.success(data, 'Optional message')
// → { success: true, data: {...}, message: "Optional message" }

// Success with pagination
res.success(this.paginate(items, meta))
// → { success: true, data: [...], meta: { total, page, limit } }

// Error (via typed exception — caught by global ExceptionFilter)
throw new GenericException('Something went wrong')
// → { success: false, data: null, message: "Something went wrong" }
```

---

## Rate Limiting

Apply throttling on sensitive endpoints:

```typescript
// Uses ThrottlerModule default limits
@UseGuards(ThrottlerGuard)
@Post('/login')
async login() { ... }

// Override to stricter limit for security-sensitive routes
@Throttle({ default: { limit: 3, ttl: 60000 } })    // 3 req/min
@Post('/forgot-password')
async forgotPassword() { ... }

@Throttle({ default: { limit: 3, ttl: 900000 } })   // 3 req/15 min
@Post('/verify-otp')
async verifyOtp() { ... }
```

---

## Async Patterns

- Always use `async/await` — no raw Promise `.then()/.catch()` chains
- Always `await` async calls — never fire-and-forget except for event emitters
- Use `Promise.all()` for parallel independent async operations

```typescript
// CORRECT: parallel independent calls
const [user, roles] = await Promise.all([
  this.userRepo.firstWhere({ id }),
  this.roleRepo.all(),
]);

// WRONG: sequential when calls are independent
const user = await this.userRepo.firstWhere({ id });
const roles = await this.roleRepo.all();
```

---

## Do Not

- Put SQL or ORM-heavy logic inside controllers or route handlers
- Put business logic inside DTO or transformer classes
- Mix unrelated domains in the same service (e.g., auth logic inside a billing service)
- Expose raw Objection.js model objects directly as API responses — always use Transformers
- Use `any` type — always define proper interfaces
- Import from `apps/` inside `libs/` (one-way dependency: apps → libs)
- Create circular module dependencies
- Use synchronous file I/O inside request handlers
