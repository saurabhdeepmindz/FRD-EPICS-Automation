# Backend Coding Standards

> **Stack:** NestJS 10+ on Node.js 20+ (TypeScript 5+), TypeORM/Prisma, plus **Microsoft Copilot Studio** integration (Direct Line / Bot Framework / custom connectors)
> **Style System:** JSDoc / TSDoc with mandatory RTM (Requirements Traceability Matrix) tags
> **Audience:** All backend engineers, AI code generators, interns and juniors performing maintenance
> **Applies to:** every `.ts` file under `apps/<module>/src/`, `lib/`, `config/`, `database/`, plus all Copilot Studio integration files (`copilot/` module — see Section 21)
> **Version:** 1.0.0
>
> Aligned with the internal *JSDoc Standards for NestJS & Node.js v1.0.0* spec and the project's *Backend-FolderStructure-Template.md*. Extended with Copilot Studio integration, Python-style discipline (matching the company's *CodingStandards-python.md*), and mandatory RTM traceability.

---

## 1. Core Philosophy

Documentation is a first-class citizen. Every public-facing symbol — class, method, interface, DTO, exception, NestJS module, Copilot Studio topic/action handler — must be documented **before it is merged**.

Two non-negotiable goals govern every comment we write:

1. **Traceability** — every class, method, controller route, and Copilot Studio action handler MUST trace back to the FRD / EPIC / User Story / Sub-Task that justifies its existence. If traceability is unknown at the time of writing, the value MUST be the literal string **`TBD`** so that reviewers immediately spot the gap.
2. **Hand-off readiness** — the descriptions must be detailed enough that an intern or junior engineer joining six months later can understand *what* the code does, *why* it exists, and *how* it integrates, **without reading the implementation or chasing the source FRD**. The relevant prose from FRD / EPIC / User Story / Sub-Task MUST be summarised inside the doc block.

| Limit | Value | Applies to |
|-------|-------|------------|
| Max class length | 250 lines (excl. imports) | services, controllers, gateways |
| Max method length | 30 lines | every method |
| Max parameters | 4 | beyond 4, use a DTO |
| Max nesting depth | 3 | `if` / `try` / loop levels |
| Max constructor injections | 3 | beyond 3, split the class |
| Max file length | 400 lines | any single `.ts` file |

**Golden rule:** If you exceed any limit, extract a private helper, create a mapper class, split into read/write services, or split the module. The limits exist to protect the next developer.

---

## 2. The RTM Traceability Block (MANDATORY)

Every **file**, **class**, **public method**, **DTO**, **interface**, **controller route**, and **Copilot Studio action** MUST carry the following tags. Use `TBD` whenever a value is not yet known — **never omit the tag**.

| Tag | Purpose | Example | If unknown |
|-----|---------|---------|------------|
| `@frd` | FRD section ID + title | `@frd FRD-3.2.4 — Order Document creation` | `@frd TBD` |
| `@epic` | EPIC ID + title | `@epic EPIC-DASH-07 — Conversation Lifecycle` | `@epic TBD` |
| `@userStory` | User Story ID + summary | `@userStory US-DASH-07-05 — As a user I want…` | `@userStory TBD` |
| `@subTask` | Sub-task IDs | `@subTask ST-DASH-07-05-01, ST-DASH-07-05-04` | `@subTask TBD` |
| `@rtmId` | Optional consolidated RTM row ID | `@rtmId RTM-BE-00219` | `@rtmId TBD` |
| `@acceptanceCriteria` | One-line summary or bulleted list of AC | `@acceptanceCriteria AC-1 valid → 201; AC-2 dup → 409` | `@acceptanceCriteria TBD` |
| `@frdContext` | **Prose** summary of FRD/EPIC/Story narrative | (see Section 3) | `@frdContext TBD — to be backfilled` |

The `@frdContext` block is the most important tag for intern/junior maintainability. It carries forward the business intent so a new engineer does not need to chase the original FRD.

---

## 3. File Header Block

Every `.ts` file MUST start with a JSDoc header **before the first import**.

```ts
/**
 * @file        customer.service.ts
 * @module      CustomerModule
 * @layer       service                 // controller | service | repository | dto | entity | guard | filter | interceptor | pipe | copilot
 *
 * @description
 * Service layer for the Customer domain. Any module requiring single
 * or batch customer details invokes methods on this layer.
 *
 * @frd                FRD-4.1 — Customer master data services
 * @epic               EPIC-CRM-02 — Customer Profile Management
 * @userStory          US-CRM-02-01, US-CRM-02-04
 * @subTask            ST-CRM-02-01-03, ST-CRM-02-04-02
 * @rtmId              RTM-BE-00112
 * @acceptanceCriteria
 *  - AC-1: Single customer fetched by UUID returns full DTO
 *  - AC-2: Batch fetch supports 1..500 IDs
 *  - AC-3: Missing ID raises CustomerNotFoundException → 404
 *
 * @frdContext
 * Per FRD-4.1, the system maintains a Customer master that is the
 * single source of truth for downstream modules (orders, billing,
 * support). The service exposes batch-by-IDs and single-by-ID lookups,
 * never the underlying ORM entity. Soft-deleted customers (status='archived')
 * are excluded by default per US-CRM-02-04. NFR: P95 < 150ms for batch ≤ 100.
 *
 * @author      <Name> <email>
 * @version     1.0.0
 * @since       2026-04-27
 */
```

Allowed `@layer` values: `controller`, `service`, `repository`, `dto`, `entity`, `interface`, `module`, `guard`, `filter`, `interceptor`, `pipe`, `enum`, `util`, `transformer`, `constants`, `migration`, `copilot-topic`, `copilot-action`, `copilot-connector`.

---

## 4. JSDoc Tag Reference

| Tag | Applies To | Purpose | Required? |
|-----|------------|---------|-----------|
| `@description` | class / method | What & why | Required |
| `@frd` / `@epic` / `@userStory` / `@subTask` | file / class / method / route / action | RTM traceability — `TBD` if unknown | **Required** |
| `@frdContext` | file / class | Prose summary of FRD/EPIC/Story for maintainers | **Required** |
| `@acceptanceCriteria` | file / class / method | AC satisfied here | Required |
| `@param` | method | Each parameter; `[name]` for optional | Required |
| `@returns` | method | Resolved value semantics, not just type | Required |
| `@throws` | method | Every error the caller must handle | Required |
| `@example` | class / method | A concise, runnable usage snippet | Recommended |
| `@async` | method | Explicit async marker | Convention |
| `@private` / `@protected` | method / field | Intent marker | Convention |
| `@deprecated` | class / method | Migration path + removal version | When applicable |
| `@see` | any | Link to related symbol or external doc | When applicable |
| `@since` | class / method | Version or ISO date introduced | Recommended |
| `@implements` | class | Interface contract implemented | When applicable |
| `@security` | controller / route | Authn / authz / PII concerns | Required for routes |
| `@idempotent` | route | Idempotency contract | Required for mutations |
| `@sla` / `@nfr` | service / route | Latency / throughput targets | When applicable |
| `@copilotTopic` | copilot integration | Copilot Studio topic name handled | Required (copilot) |
| `@copilotAction` | copilot integration | Copilot Studio action name | Required (copilot) |

> **TypeScript types and JSDoc types** — never duplicate the type in `@param` prose. `@param {string} id — The customer id` is redundant. Write `@param id — The customer identifier (UUID v4)`.

---

## 5. Interface & DTO Documentation

Interfaces and DTOs form the contract between layers. Document every field with an inline `/** */`. Document the interface-level purpose in a block comment with full RTM tags.

```ts
/**
 * Data Transfer Object representing a Customer record.
 * Returned by the service layer — never expose the ORM entity directly.
 *
 * @frd       FRD-4.1
 * @userStory US-CRM-02-01
 * @subTask   ST-CRM-02-01-03
 *
 * @frdContext
 * Per FRD-4.1, the public Customer shape exposes id, name, email, and
 * E.164 phone number only. Internal fields (createdBy, audit timestamps)
 * are never exposed to the FE.
 *
 * @since 1.0.0
 */
export interface CustomerDTO {
  /** UUID v4 unique identifier for the customer. */
  id: string;
  /** Customer's given name. */
  firstName: string;
  /** Primary contact email — validated on write. */
  email: string;
  /**
   * E.164-formatted phone number.
   * @example '+447700900000'
   */
  phoneNumber: string;
}
```

DTO-level rules:

1. One DTO per file under `dto/` (`create.dto.ts`, `update.dto.ts`, etc.) — see *Backend-FolderStructure-Template.md* §2.4.
2. Validation decorators (`class-validator` / `zod`) live with the DTO and are documented inline.
3. DTOs are immutable from the consumer's perspective — no methods on DTOs except passive transformations.

---

## 6. Service Interface (DI Contract)

Define a contract interface first; the concrete service `@implements` it. This enables NestJS DI tokens and future provider swaps.

```ts
/**
 * Contract for the Customer Service layer.
 *
 * @description
 * Any module requiring customer data must depend on this token,
 * not on the concrete CustomerService class.
 *
 * @frd       FRD-4.1
 * @epic      EPIC-CRM-02
 * @userStory US-CRM-02-01, US-CRM-02-04
 * @subTask   ST-CRM-02-01-03
 *
 * @frdContext
 * Per FRD-4.1, customer data is exposed as a stable interface. Soft-deleted
 * customers are excluded by default. Batch fetch caps at 500 IDs per AC-2.
 *
 * @example
 * @Inject(CUSTOMER_SERVICE_TOKEN)
 * private readonly customerService: ICustomerService
 *
 * @since 1.0.0
 */
export interface ICustomerService {
  /**
   * Fetches full details for a batch of customers.
   *
   * @async
   * @param customerIds - Non-empty array of customer UUID v4 strings (max 500)
   * @returns Resolved array of CustomerDTO in the same order as input
   * @throws {InvalidArgumentException} customerIds is null/empty/oversized
   * @throws {CustomerServiceException} on data-source failure
   *
   * @frd                FRD-4.1
   * @userStory          US-CRM-02-01
   * @subTask            ST-CRM-02-01-03
   * @acceptanceCriteria AC-2 batch fetch supports 1..500 IDs
   * @nfr                P95 < 150ms for batch ≤ 100
   */
  getCustomerDetails(customerIds: string[]): Promise<CustomerDTO[]>;

  /**
   * Fetches full details for a single customer.
   *
   * @async
   * @param customerId - UUID v4 of the customer to look up
   * @returns Resolved CustomerDTO
   * @throws {InvalidArgumentException} customerId is null or empty
   * @throws {CustomerNotFoundException} no customer matches
   * @throws {CustomerServiceException} on data-source failure
   *
   * @frd                FRD-4.1
   * @userStory          US-CRM-02-04
   * @subTask            ST-CRM-02-04-02
   * @acceptanceCriteria AC-3 missing ID → 404
   */
  getCustomerDetails(customerId: string): Promise<CustomerDTO>;
}
```

---

## 7. Service Implementation

The implementation class must document: (a) class-level design decisions + RTM, (b) every public method via `@inheritDoc` (lean — the contract owns the prose), (c) every private helper with a short RTM block.

### 7.1 Class-level block

```ts
/**
 * @file customer.service.ts
 * @module CustomerModule
 * @layer service
 *
 * @description
 * Concrete implementation of ICustomerService.
 * Maps entities to DTOs — never leaks ORM entities upward.
 *
 * Design decisions:
 * - Overloaded getCustomerDetails mirrors the original Java API surface
 * - Guard helpers keep validation DRY and remove null-check boilerplate
 * - wrapRepositoryError centralises error logging and wrapping
 * - toDTO is a pure function — no side effects, trivially unit-testable
 *
 * @implements         {ICustomerService}
 * @frd                FRD-4.1
 * @epic               EPIC-CRM-02
 * @userStory          US-CRM-02-01, US-CRM-02-04
 * @subTask            ST-CRM-02-01-03, ST-CRM-02-04-02
 * @acceptanceCriteria AC-1, AC-2, AC-3 (see file header)
 *
 * @frdContext
 * Per FRD-4.1, this is the canonical implementation backing Customer reads
 * across the platform. It never exposes the ORM entity. Soft-deleted records
 * are filtered at the repository call site.
 *
 * @since 1.0.0
 */
@Injectable()
export class CustomerService implements ICustomerService { /* … */ }
```

### 7.2 Public method via `@inheritDoc`

```ts
/**
 * {@inheritDoc ICustomerService.getCustomerDetails}
 *
 * @async
 * @frd       FRD-4.1
 * @userStory US-CRM-02-01
 */
async getCustomerDetails(input: string | string[]) {
  if (Array.isArray(input)) return this.fetchMultipleCustomers(input);
  return this.fetchSingleCustomer(input);
}
```

### 7.3 Private helper

```ts
/**
 * Resolves a batch of customer IDs to full DTOs.
 *
 * @private
 * @async
 * @param customerIds - Caller-supplied; validated before calling
 * @throws {InvalidArgumentException} when customerIds is null or empty
 * @throws {CustomerServiceException} on repository failure
 *
 * @frd       FRD-4.1
 * @userStory US-CRM-02-01
 * @subTask   ST-CRM-02-01-03
 */
private async fetchMultipleCustomers(customerIds: string[]): Promise<CustomerDTO[]> {
  this.assertNonEmptyArray(customerIds, 'customerIds');
  try {
    const entities = await this.customerRepository.findBy({ id: In(customerIds) });
    return entities.map((e) => this.toDTO(e));
  } catch (error) {
    throw this.wrapRepositoryError(error, 'fetchMultipleCustomers');
  }
}
```

---

## 8. Controller Documentation

NestJS controllers are HTTP entry points. Every route MUST document: HTTP verb + path, auth, RTM block, request DTO, response DTO, and every `@throws` mapped to its HTTP status.

```ts
/**
 * REST controller for the Customer resource.
 * Base route: /api/v1/customers
 *
 * @controller customers
 * @layer      controller
 * @uses       {JwtAuthGuard} — all endpoints require a valid JWT
 *
 * @frd       FRD-4.1
 * @epic      EPIC-CRM-02
 * @userStory US-CRM-02-01, US-CRM-02-04
 * @subTask   ST-CRM-02-01-03
 *
 * @frdContext
 * Public REST surface for the Customer master. All routes require a JWT;
 * the principal's role determines field-level visibility (FRD-4.1.5).
 *
 * @since 1.0.0
 */
@Controller('api/v1/customers')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(
    @Inject(CUSTOMER_SERVICE_TOKEN)
    private readonly customerService: ICustomerService,
  ) {}

  /**
   * GET /api/v1/customers/:id — fetch a single customer.
   *
   * @async
   * @param id - UUID v4 path parameter
   * @returns CustomerDTO (200)
   * @throws {InvalidArgumentException}    400 — invalid UUID
   * @throws {CustomerNotFoundException}   404 — no match
   * @throws {CustomerServiceException}    500 — data-source failure
   *
   * @frd                FRD-4.1
   * @userStory          US-CRM-02-04
   * @subTask            ST-CRM-02-04-02
   * @acceptanceCriteria AC-3 missing ID → 404
   * @security           JWT required; role-filtered fields per FRD-4.1.5
   * @idempotent         GET — naturally idempotent
   * @nfr                P95 < 150ms
   */
  @Get(':id')
  async getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<CustomerDTO> {
    return this.customerService.getCustomerDetails(id);
  }
}
```

Controller-level rules:

1. Controllers are **thin** — they ONLY validate request shape and delegate to a service.
2. The constructor injects via the `@Inject(<TOKEN>)` pattern and types against the **interface**, never the concrete service.
3. Every route MUST list every `@throws` and the HTTP status it maps to.
4. Every mutation route MUST carry an `@idempotent` block (idempotency-key contract or "not idempotent — duplicate triggers 409").
5. Every route MUST carry a `@security` block.

---

## 9. Module Documentation

```ts
/**
 * NestJS module wiring the Customer feature.
 *
 * @module CustomerModule
 * @layer  module
 *
 * @description
 * Registers CustomerController, binds the ICustomerService DI token to
 * CustomerService, and exposes the token to consumers.
 *
 * @frd       FRD-4.1
 * @epic      EPIC-CRM-02
 * @userStory US-CRM-02-01
 * @subTask   ST-CRM-02-01-01
 *
 * @frdContext
 * The module is the unit of cohesion for Customer-related backend code.
 * Other modules should import CustomerModule and inject CUSTOMER_SERVICE_TOKEN —
 * never the concrete class.
 *
 * @since 1.0.0
 */
@Module({
  controllers: [CustomerController],
  providers: [
    { provide: CUSTOMER_SERVICE_TOKEN, useClass: CustomerService },
  ],
  exports: [CUSTOMER_SERVICE_TOKEN],
})
export class CustomerModule {}
```

---

## 10. Entity Documentation (TypeORM / Prisma)

```ts
/**
 * Persistence entity for a Customer row.
 *
 * @entity     customers
 * @layer      entity
 *
 * @frd       FRD-4.1
 * @userStory US-CRM-02-01
 * @subTask   ST-CRM-02-01-02
 *
 * @frdContext
 * One row per customer. Email is uniquely indexed. Soft-delete via `status`
 * column (`active` | `archived`). Audit timestamps maintained by listeners.
 *
 * @since 1.0.0
 */
@Entity('customers')
@Index(['email'], { unique: true })
export class CustomerEntity {
  /** UUID v4 primary key. */
  @PrimaryGeneratedColumn('uuid') id!: string;
  /** Lowercased on write. */
  @Column() email!: string;
  /** Lifecycle state — 'archived' is excluded from default queries. */
  @Column({ type: 'enum', enum: ['active', 'archived'], default: 'active' }) status!: 'active' | 'archived';
  /** Insert timestamp (UTC). */
  @CreateDateColumn() createdAt!: Date;
  /** Last-update timestamp (UTC). */
  @UpdateDateColumn() updatedAt!: Date;
}
```

---

## 11. Exception Documentation

Every exception class MUST document: what triggers it, the HTTP status it maps to, and include a usage example. Every exception is RTM-tagged.

```ts
/**
 * Thrown when a requested customer does not exist.
 * Maps to HTTP 404 Not Found.
 *
 * @extends   NotFoundException
 * @frd       FRD-4.1
 * @userStory US-CRM-02-04
 * @subTask   ST-CRM-02-04-02
 *
 * @example
 * throw new CustomerNotFoundException('550e8400-e29b-41d4-a716-446655440000');
 *
 * @since 1.0.0
 */
export class CustomerNotFoundException extends NotFoundException {
  constructor(customerId: string) {
    super({ message: `Customer not found: ${customerId}`, code: 'CUSTOMER_NOT_FOUND' });
  }
}
```

---

## 12. Class & Method Length Rules

### 12.1 Class — 250 lines max

Beyond 250 lines a class is doing too much. Signs to split:
- More than one private "helper cluster"
- More than 2–3 injected constructor dependencies
- Methods only called by some other methods (cohesion problem)

Refactoring options:
- Split into read/write services: `CustomerReadService`, `CustomerWriteService`
- Extract a mapper: `CustomerMapper`
- Extract a validator: `CustomerValidator`

### 12.2 Method — 30 lines max

Apply the *newspaper rule*: important logic at the top, details delegated downward.
- Guard clauses at the top — fail fast, no deep nesting
- One level of abstraction per method
- Repeated guard patterns become private helpers (e.g. `assertNonEmptyArray`)

### 12.3 One exported class per file

Related types (interface + DTO) may share a file only when both are tightly coupled and combined under ~40 lines. Otherwise: **one class = one file**.

---

## 13. Naming Conventions

| Construct | Convention | Example |
|-----------|------------|---------|
| File (NestJS artefact) | `<slug>.<artefact>.ts` | `customer.service.ts`, `customer.controller.ts` |
| Module class | `<Slug>Module` | `CustomerModule` |
| Service class | `<Slug>Service` | `CustomerService` |
| Service interface | `I<Slug>Service` | `ICustomerService` |
| DI token | `UPPER_SNAKE_CASE_TOKEN` | `CUSTOMER_SERVICE_TOKEN` |
| Controller class | `<Slug>Controller` | `CustomerController` |
| DTO | `<Slug><Action>Dto` | `CustomerCreateDto` |
| Entity | `<Slug>Entity` | `CustomerEntity` |
| Enum | `<Slug>Status` / `<Slug>Type` | `CustomerStatus` |
| Exception | `<Slug><Reason>Exception` | `CustomerNotFoundException` |
| Migration | `create.<table>.js` | `create.customer.js` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_BATCH_SIZE` |
| Variables / methods | `camelCase` | `fetchSingleCustomer` |
| Private members | `_camelCase` (optional) or just `camelCase` | `_customerRepository` |

---

## 14. Error Handling

### 14.1 Layered exception strategy

- **Domain exceptions** extend NestJS `HttpException` (or its subclasses) and map to a known HTTP status.
- **Validation** uses `class-validator` + `ValidationPipe`. Validation errors auto-map to 400.
- **Unknown / repository errors** are wrapped in a domain exception so the original cause is preserved.

```ts
// ❌ WRONG — original stack trace is lost
throw new CustomerServiceException('Something went wrong');

// ✅ CORRECT — cause is preserved and logged
this.logger.error(`Error in ${method}`, error instanceof Error ? error.stack : error);
throw new CustomerServiceException(`Failed during ${method}`, error);
```

### 14.2 Global filter

A single `AllExceptionsFilter` (in `lib/common/`) translates non-Http exceptions to a uniform error envelope:

```json
{ "success": false, "code": "INTERNAL_ERROR", "message": "...", "traceId": "..." }
```

Add `@security` notes whenever an error message could leak internal state.

---

## 15. Logging

Use NestJS scoped `Logger`:

| Level | Use for |
|-------|---------|
| `logger.debug` | entry/exit of methods (dev only, stripped in prod) |
| `logger.log`   | significant business events |
| `logger.warn`  | recoverable anomalies |
| `logger.error` | exceptions — always include the stack trace |

Every catch block MUST include the RTM IDs in the structured log payload so logs are greppable by FRD/User Story:

```ts
this.logger.error('customer.fetch failed', {
  rtm: { frd: 'FRD-4.1', userStory: 'US-CRM-02-04' },
  customerId,
  err,
});
```

**Never `console.log` in committed code.**

---

## 16. Configuration & Secrets

- All env access goes through `config/*.ts` files; **never** read `process.env` outside `config/`.
- Secrets are mandatory at boot — `config/<domain>.ts` MUST throw at startup if a required env var is missing.
- Never log secrets. Mask any field whose name matches `/(pass|secret|token|key)/i` in interceptors.

---

## 17. Migrations

- One file per table under `database/migration/` — see *Backend-FolderStructure-Template.md* §4.1.
- Every migration carries an RTM block documenting which FRD/User Story added the table or column.
- Migrations are forward-only in production; rollbacks happen via a new forward migration.

```ts
/**
 * Adds the customers table.
 *
 * @frd       FRD-4.1
 * @userStory US-CRM-02-01
 * @subTask   ST-CRM-02-01-02
 *
 * @frdContext
 * Initial Customer master per FRD-4.1. Email is uniquely indexed; soft-delete
 * via status column.
 *
 * @since 2026-04-27
 */
```

---

## 18. Testing

- **80% line coverage minimum** across each module (`apps/<module>/`).
- **Unit tests** for services and pure utils (Jest).
- **Integration tests** for controllers using `Test.createTestingModule` + an in-memory DB or test container.
- **E2E tests** for the public REST surface (Supertest).
- Every test file's `describe` block carries the RTM block:

```ts
describe('CustomerController.getById [FRD-4.1 / US-CRM-02-04 / ST-CRM-02-04-02]', () => { /* … */ });
```

A test missing its RTM tag fails the lint rule `local/require-rtm-tags-on-tests`.

---

## 19. Async Rules

- All I/O is `async`. Never block the event loop.
- Never `setTimeout(..., 0)` to "yield" — use proper queueing.
- Never use `Promise.all` for unbounded fan-out — cap with a concurrency-limited helper (`p-limit`).

---

## 20. Imports & Module Boundaries

```ts
// 1. Node / standard
import { randomUUID } from 'crypto';

// 2. Third-party
import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';

// 3. Internal — absolute paths only (tsconfig "paths")
import { ICustomerService } from '@customer/interface/customer.service.interface';
import { CustomerEntity } from '@customer/entity/customer.entity';

// 4. Same-folder relative
import { CustomerMapper } from './customer.mapper';
```

**Rules:**
- A module under `apps/<module>/` MUST NOT import from another `apps/<other-module>/` directly. Cross-module reuse goes via `lib/`.
- `dto/`, `entity/`, `interface/` MUST NOT import runtime classes from `service/`.
- `controller/` imports the **interface** + DI token, not the concrete service class.

---

## 21. Microsoft Copilot Studio Integration

The Copilot Studio integration lives in a dedicated module: `apps/copilot/`. It receives webhook calls from Copilot Studio (or Azure Bot Framework / Direct Line) and dispatches them to existing backend services. **The same RTM and JSDoc rules apply** — extended with Copilot-specific tags.

### 21.1 Folder shape (extends *Backend-FolderStructure-Template.md*)

```
apps/copilot/
└── src/
    ├── module.ts
    ├── main.ts
    ├── controller/
    │   └── copilot.webhook.controller.ts      # entry point for bot turns
    ├── service/
    │   └── copilot.dispatcher.service.ts      # routes topics/actions → domain services
    ├── topics/                                # one file per Copilot Studio topic
    │   ├── greeting.topic.ts
    │   └── createorder.topic.ts
    ├── actions/                               # one file per Copilot Studio custom action
    │   ├── lookupcustomer.action.ts
    │   └── createorderdocument.action.ts
    ├── connectors/                            # outbound (Power Platform custom connector schemas)
    │   └── crm.connector.ts
    ├── dto/
    │   ├── activity.dto.ts                    # Bot Framework Activity shape
    │   ├── adaptivecard.dto.ts                # Adaptive Card payloads
    │   └── action-context.dto.ts              # input/output shapes per action
    ├── guards/
    │   └── copilot-signature.guard.ts         # validates HMAC signature on webhook
    ├── interceptors/
    │   └── conversation-trace.interceptor.ts  # injects conversationId/userId into logs
    ├── enum/
    │   └── topic-name.enum.ts
    ├── utils/
    │   └── adaptive-card.util.ts
    ├── transformer/
    │   └── activity.transformer.ts
    └── constants/
        └── copilot.constants.ts
```

### 21.2 New JSDoc tags for Copilot artefacts

| Tag | Applies To | Purpose |
|-----|------------|---------|
| `@copilotTopic` | topic file / handler | Copilot Studio topic name (must match Studio config exactly) |
| `@copilotAction` | action file / handler | Copilot Studio custom action name |
| `@copilotIntent` | topic / action | Trigger phrase / intent description |
| `@copilotInputs` | action | Input variable names + types (mirror Studio definition) |
| `@copilotOutputs` | action | Output variable names + types |
| `@copilotChannel` | controller | Allowed channels (Teams, web, M365 Copilot, etc.) |
| `@copilotAuth` | controller / action | Auth mode (User-passed, Service-Principal, Bearer, none) |
| `@adaptiveCard` | response | Adaptive Card schema reference / version |

### 21.3 Webhook controller template

```ts
/**
 * @file        copilot.webhook.controller.ts
 * @module      CopilotModule
 * @layer       controller
 *
 * @description
 * Single inbound endpoint for Copilot Studio / Bot Framework activities.
 * Validates the HMAC signature, normalises the Activity, and dispatches
 * to topic/action handlers via CopilotDispatcherService.
 *
 * @frd       FRD-7.1 — Conversational interface
 * @epic      EPIC-COPILOT-01 — Copilot Studio integration
 * @userStory US-COPILOT-01-01, US-COPILOT-01-02
 * @subTask   ST-COPILOT-01-01-01
 *
 * @copilotChannel Teams, M365 Copilot, web (Direct Line)
 * @copilotAuth    HMAC signature + (optional) bearer for outbound user context
 *
 * @frdContext
 * Per FRD-7.1, the platform exposes a Copilot Studio bot that lets users
 * trigger backend workflows (lookup customer, create order document) from
 * inside Teams or M365 Copilot. The bot calls back into this webhook for
 * every turn. Handlers are dispatched per topic name; unknown topics are
 * answered with a generic "I didn't catch that" Adaptive Card per AC-4.
 *
 * @since 2026-04-27
 */
@Controller('api/v1/copilot')
@UseGuards(CopilotSignatureGuard)
export class CopilotWebhookController {
  constructor(
    @Inject(COPILOT_DISPATCHER_TOKEN)
    private readonly dispatcher: ICopilotDispatcherService,
  ) {}

  /**
   * POST /api/v1/copilot/messages — receives a Bot Framework Activity.
   *
   * @async
   * @param activity - Validated Activity payload (per Bot Framework v3 schema)
   * @returns Activity reply (text, Adaptive Card, or empty 200 for ack-only)
   * @throws {InvalidSignatureException}   401 — bad/missing HMAC signature
   * @throws {UnsupportedActivityException} 400 — activity type not handled
   * @throws {CopilotDispatchException}     500 — handler failure
   *
   * @frd                FRD-7.1
   * @userStory          US-COPILOT-01-01
   * @subTask            ST-COPILOT-01-01-01
   * @acceptanceCriteria AC-1 valid activity → 200 reply; AC-2 bad sig → 401; AC-4 unknown topic → fallback card
   * @security           HMAC validated by CopilotSignatureGuard. PII in payload is logged with field-level masking.
   * @idempotent         Activity.id is used as idempotency key in the dispatcher
   * @copilotChannel     Teams, M365 Copilot, web
   */
  @Post('messages')
  async receive(@Body() activity: ActivityDto): Promise<ActivityDto | void> {
    return this.dispatcher.dispatch(activity);
  }
}
```

### 21.4 Topic handler template

A topic in Copilot Studio matches a user intent. We mirror each topic with one file under `topics/` so Studio config and code stay aligned 1:1.

```ts
/**
 * Handles the "Create Order" topic from Copilot Studio.
 *
 * @copilotTopic   create_order
 * @copilotIntent  "I want to place an order", "create order", "raise a new request"
 * @copilotAuth    User-passed (uses the calling user's bearer token)
 *
 * @frd                FRD-7.1.3
 * @epic               EPIC-COPILOT-01
 * @userStory          US-COPILOT-01-02 — As a Teams user I want to create an order from chat
 * @subTask            ST-COPILOT-01-02-01, ST-COPILOT-01-02-02
 * @acceptanceCriteria AC-1 happy path → confirmation card; AC-2 missing plan → upgrade card; AC-3 backend error → retryable card
 *
 * @frdContext
 * Per FRD-7.1.3, this topic gathers the order parameters (type, jurisdiction,
 * instructions) via Adaptive Cards, then calls the existing OrderDocument
 * service. The user must have an active plan; otherwise the bot returns
 * an "Upgrade plan" card. Errors do NOT abort the dialog — the user can retry.
 *
 * @example
 * await topic.handle(activity, ctx);
 *
 * @since 2026-04-27
 */
@Injectable()
export class CreateOrderTopic implements ICopilotTopic {
  /**
   * Handles a single turn for the create-order conversation.
   *
   * @async
   * @param activity - Inbound Activity
   * @param ctx      - Conversation state for this user (turn-scoped)
   * @returns Reply Activity (Adaptive Card)
   * @throws {NoActivePlanException}  user lacks an active plan → upgrade card
   * @throws {CopilotDispatchException} downstream failure
   *
   * @frd       FRD-7.1.3
   * @userStory US-COPILOT-01-02
   * @subTask   ST-COPILOT-01-02-01
   */
  async handle(activity: ActivityDto, ctx: ConversationContext): Promise<ActivityDto> { /* … */ }
}
```

### 21.5 Custom action template

A Copilot Studio **custom action** is a typed function the Studio author can call from any topic. Inputs/outputs MUST mirror the Studio schema exactly.

```ts
/**
 * Custom action: lookup_customer
 *
 * @copilotAction  lookup_customer
 * @copilotInputs
 *  - customerId: string (UUID v4) — required
 * @copilotOutputs
 *  - found:        boolean
 *  - displayName:  string
 *  - planActive:   boolean
 * @copilotAuth    Service-Principal (acts as the platform, not the calling user)
 *
 * @frd                FRD-7.1.4
 * @epic               EPIC-COPILOT-01
 * @userStory          US-COPILOT-01-03 — Teams user can ask "look up customer X"
 * @subTask            ST-COPILOT-01-03-01
 * @acceptanceCriteria AC-1 valid id → outputs populated; AC-2 not found → found=false, no exception
 *
 * @frdContext
 * Per FRD-7.1.4, the bot needs a side-effect-free lookup of customer
 * existence + plan state. The action wraps ICustomerService.getCustomerDetails
 * and translates not-found into outputs (instead of throwing) so the Studio
 * author can branch on `found` without try/catch.
 *
 * @since 2026-04-27
 */
@Injectable()
export class LookupCustomerAction implements ICopilotAction<LookupCustomerInput, LookupCustomerOutput> {
  constructor(
    @Inject(CUSTOMER_SERVICE_TOKEN)
    private readonly customers: ICustomerService,
  ) {}

  /**
   * Executes the action.
   *
   * @async
   * @param input - Validated by Studio + class-validator on this side
   * @returns LookupCustomerOutput — never throws not-found
   * @throws {CopilotDispatchException} infra failure — bubbled up to dispatcher
   *
   * @frd       FRD-7.1.4
   * @userStory US-COPILOT-01-03
   * @subTask   ST-COPILOT-01-03-01
   */
  async execute(input: LookupCustomerInput): Promise<LookupCustomerOutput> { /* … */ }
}
```

### 21.6 Connector schema template

```ts
/**
 * Power Platform Custom Connector spec for the CRM API.
 *
 * @copilotChannel Power Platform (custom connector)
 * @copilotAuth    OAuth 2.0 (Authorization Code) — secrets in Azure Key Vault
 *
 * @frd                FRD-7.2
 * @epic               EPIC-COPILOT-01
 * @userStory          US-COPILOT-01-05 — Studio author can call CRM endpoints
 * @subTask            ST-COPILOT-01-05-01
 *
 * @frdContext
 * Per FRD-7.2, Studio authors should be able to call our REST API from
 * inside topics. This connector exposes a curated subset of /api/v1/customers
 * routes; admin/PII routes are explicitly excluded.
 *
 * @since 2026-04-27
 */
export const crmConnectorSpec = { /* OpenAPI 2.0 / Swagger */ };
```

### 21.7 Copilot-specific rules

1. **Topic name and action name in code MUST match Studio config exactly.** A pre-commit hook validates by reading a sync file (`copilot/topics.manifest.json`).
2. **No business logic in topics/actions** — they are thin adapters over existing domain services.
3. **All inbound activities are signature-verified** by `CopilotSignatureGuard`.
4. **Idempotency:** every action handler treats `activity.id` as the idempotency key — replays MUST NOT duplicate side-effects.
5. **PII handling:** any Activity field that may contain PII (`from.id`, `text`, `attachments`) is masked in logs by `ConversationTraceInterceptor`.
6. **Adaptive Cards** are rendered via helpers in `utils/adaptive-card.util.ts`; never inline JSON in handlers.
7. **Outbound calls to Microsoft Graph / Dataverse** go through `lib/dmz/` clients — never directly from a topic/action.
8. **Every topic and action carries the full RTM block + Copilot-specific tags.**

---

## 22. Configuration Class Boilerplate (config + Pydantic-style discipline)

Aligned with the Python standard's spirit — strong typing, fail-fast validation, no magic literals.

```ts
/**
 * Application configuration loaded from environment variables.
 *
 * @frd       FRD-1.0
 * @userStory US-PLATFORM-00-01
 * @subTask   ST-PLATFORM-00-01-01
 *
 * @frdContext
 * Per FRD-1.0, the application MUST fail at boot if any required secret
 * is missing. Optional values fall back to documented defaults.
 *
 * @since 1.0.0
 */
@Injectable()
export class AppConfig {
  /** Postgres connection string (required). */
  readonly databaseUrl: string;
  /** Max records per batch read (default 500). */
  readonly maxBatchSize: number;
  /** Bot Framework app ID (required for Copilot Studio integration). */
  readonly botAppId: string;
  /** Bot Framework signing secret — used by CopilotSignatureGuard (required). */
  readonly botSigningSecret: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.databaseUrl       = required(env, 'DATABASE_URL');
    this.maxBatchSize      = optionalInt(env, 'MAX_BATCH_SIZE', 500);
    this.botAppId          = required(env, 'BOT_APP_ID');
    this.botSigningSecret  = required(env, 'BOT_SIGNING_SECRET');
  }
}
```

---

## 23. Tooling

| Tool | Purpose | Config |
|------|---------|--------|
| `eslint` + `@typescript-eslint` | Linting | `.eslintrc.cjs` |
| `eslint-plugin-jsdoc` | Enforce JSDoc + RTM tags | shared rule set |
| `prettier` | Formatting | `.prettierrc` |
| `typescript --strict` | Type safety | `tsconfig.json` |
| `jest` + `@nestjs/testing` | Unit + integration tests | per module |
| `supertest` | E2E HTTP tests | per module |
| `husky` + `lint-staged` | Pre-commit gates | `.husky/` |
| `typedoc` | API site generation | `typedoc.json` |
| `local/require-rtm-tags` | Custom ESLint rule | shared |
| `bot-framework-emulator` | Local Copilot turn replay | dev only |

A custom ESLint rule (`local/require-rtm-tags`) MUST fail CI when an exported class, method, controller route, topic, or action is missing any of: `@frd`, `@epic`, `@userStory`, `@subTask`, `@frdContext`. `TBD` is an accepted value.

---

## 24. Code Generation Rules for AI

When generating backend code, the AI MUST:

1. Emit a file header per Section 3 with all RTM tags. Use `TBD` when unknown — never omit.
2. Always include `@frdContext` prose summarising the FRD/EPIC/User Story narrative when source material is supplied.
3. Apply Sections 5–11 to every DTO, interface, service, controller, module, entity, exception.
4. Apply Section 21 to every Copilot Studio topic, action, connector — the topic/action name MUST match Studio config exactly.
5. Respect length limits in Section 1. Split classes / extract helpers / extract mappers / extract validators before exceeding them.
6. Follow Section 13 naming conventions exactly.
7. Use the folder layout from *Backend-FolderStructure-Template.md* — never invent new top-level folders.
8. Insert `// TODO(rtm)` comments wherever a tag was filled with `TBD`, so gaps are greppable.
9. Never produce code without RTM tags — even for utilities and migrations.

---

## 25. Quick-Reference Checklist (use before opening a PR)

- [ ] File header present with all RTM tags + `@frdContext`
- [ ] Every public class, method, route, topic, action has its own RTM block
- [ ] No file > 400 lines, no class > 250, no method > 30, no constructor > 3 deps
- [ ] DTOs and entities have inline `/** */` on every field
- [ ] Every controller route lists every `@throws` with the HTTP status it maps to
- [ ] Every controller route has `@security` and (if mutation) `@idempotent`
- [ ] Every Copilot topic/action has matching name + manifest entry
- [ ] No `console.log`; all catch blocks log RTM IDs in structured payload
- [ ] Tests carry RTM IDs in their `describe` blocks
- [ ] Coverage ≥ 80%
- [ ] ESLint, Prettier, type-check, RTM-tag rule all green
