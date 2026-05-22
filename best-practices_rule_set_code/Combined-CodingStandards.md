# Combined Coding Standards — Frontend, Backend & Copilot Studio Integration

> **Purpose:** Single authoritative coding standard the AI will consume to generate **Low-Level Design (LLD) documents** and **pseudo-code / source code** for the project. It unifies the three layers of the stack:
>
> - **Frontend** — Next.js (App Router) + React 18+ + TypeScript 5+ + Redux Toolkit / RTK Query
> - **Backend** — NestJS 10+ on Node.js 20+, TypeORM/Prisma
> - **Copilot Studio Integration** — Microsoft Copilot Studio + Bot Framework / Direct Line + Power Platform custom connectors
>
> **Audience:** All engineers, AI code generators, interns and juniors performing maintenance.
>
> **Companion documents (already published in this folder):**
> - *Backend-FolderStructure-Template.md*
> - *Frontend-FolderStructure-Template.md*
> - *Frontend-CodingStandards.md* (deep dive — frontend only)
> - *Backend-CodingStandards.md* (deep dive — backend + Copilot Studio)
>
> This file is the **master spec**. When the AI generates LLD or code, it MUST treat this file as canonical. The deep-dive files exist for human reference; this file repeats the load-bearing rules so the AI does not have to chase cross-references.
>
> **Version:** 1.0.0 — 2026-04-27

---

## 0. How the AI Should Use This Document

When the user asks the AI to generate an **LLD** or **pseudo-code / source code**, the AI MUST:

1. **Read Section 1** (Core Philosophy) and apply the limits across every artefact it emits.
2. **Apply Section 2** (RTM Traceability) to every file, class, component, hook, controller route, topic, and action — without exception. Use `TBD` whenever a value is not yet known. **NEVER omit a tag.**
3. **Apply Section 3** (File Header Block) to every file regardless of layer.
4. **Pick the layer-specific section** (Frontend §5–11, Backend §12–18, Copilot §19) for the artefact being generated.
5. **Apply the cross-cutting sections** (Naming §20, Errors §21, Logging §22, Security §23, Testing §24, Tooling §25) to every artefact.
6. **Run the LLD checklist** in Section 26 before finalising any LLD output.
7. **Run the PR checklist** in Section 27 mentally before finalising any code output.

The AI MUST generate **both** the doc-block AND the code; doc-blocks without code or code without doc-blocks fail the standard.

---

## 1. Core Philosophy & Universal Limits

Documentation is a first-class citizen. Every public-facing symbol — class, component, method, hook, controller route, DTO, interface, exception, NestJS module, Copilot Studio topic/action handler — MUST be documented before merge.

Two non-negotiable goals govern every comment we write:

1. **Traceability** — every symbol traces back to FRD / EPIC / User Story / Sub-Task. If unknown: `TBD`.
2. **Hand-off readiness** — descriptions are detailed enough that an intern joining six months later can understand *what*, *why*, *how* without reading the implementation or chasing the source FRD. The relevant prose from FRD / EPIC / User Story / Sub-Task MUST be summarised in the doc-block.

### 1.1 Universal limits

| Limit | Frontend | Backend | Copilot |
|-------|---------:|--------:|--------:|
| Max file length (lines) | 400 | 400 | 400 |
| Max class / component length | 250 | 250 | 250 |
| Max method / function length | 30 | 30 | 30 |
| Max parameters / props | 4 props on a component, 4 params on a function (use a typed object beyond) | 4 (use a DTO beyond) | 4 (use input DTO beyond) |
| Max constructor injections | n/a | 3 | 3 |
| Max nesting depth | 3 (incl. JSX) | 3 | 3 |
| Max JSX depth | 4 | n/a | n/a |

**Golden rule:** If you exceed any limit, extract a sub-component / hook / private helper / mapper / validator, or split the file. The limits exist to protect the next developer.

---

## 2. RTM Traceability — MANDATORY EVERYWHERE

Every **file**, **class**, **component**, **public method**, **hook**, **controller route**, **RTK Query endpoint**, **Redux slice**, **Copilot topic**, **Copilot action**, **migration**, and **test `describe` block** MUST carry the following tags. Use `TBD` when unknown — **never omit**.

### 2.1 Standard tag set

| Tag | Purpose | Example | If unknown |
|-----|---------|---------|------------|
| `@frd` | FRD section ID + title | `@frd FRD-3.2.4 — Order Document creation` | `@frd TBD` |
| `@epic` | EPIC ID + title | `@epic EPIC-DASH-07 — Conversation Lifecycle` | `@epic TBD` |
| `@userStory` | User Story ID + Gherkin-style summary | `@userStory US-DASH-07-05 — As a user I want to attach an order document so that…` | `@userStory TBD` |
| `@subTask` | Sub-task ID(s) implemented here | `@subTask ST-DASH-07-05-02, ST-DASH-07-05-03` | `@subTask TBD` |
| `@rtmId` | Optional consolidated RTM row ID | `@rtmId RTM-FE-00428` | `@rtmId TBD` |
| `@acceptanceCriteria` | One-line summary or bulleted list of AC | `@acceptanceCriteria AC-1 valid → 201; AC-2 dup → 409` | `@acceptanceCriteria TBD` |

### 2.2 The mandatory `@frdContext` block

Every file-level and class-level header MUST include a prose block summarising the relevant FRD / EPIC / User Story / Sub-Task narrative so that maintainers do not have to chase the original document. **This is the single most important rule for intern/junior maintainability.**

```ts
/**
 * @frdContext
 * (3–10 sentences. Cover: actor, goal, business rule, edge cases, NFRs.
 *  Copy/condense from the source FRD / EPIC / User Story so a future
 *  maintainer never has to leave the file to understand intent.)
 */
```

If the source narrative is unavailable: `@frdContext TBD — to be backfilled when RTM is finalised.` and add `// TODO(rtm)` so it is greppable.

### 2.3 Layer-specific extension tags

| Tag | Layer | Required when |
|-----|-------|---------------|
| `@a11y` | Frontend | every interactive component |
| `@perf` | Frontend / Backend | when memoisation / SLA matters |
| `@security` | Frontend / Backend | every controller route, every component handling PII |
| `@idempotent` | Backend (mutations) | every POST/PUT/PATCH/DELETE |
| `@sla` / `@nfr` | Backend | when latency/throughput target documented |
| `@copilotTopic` | Copilot | every topic file/handler |
| `@copilotAction` | Copilot | every custom action |
| `@copilotIntent` | Copilot | every topic |
| `@copilotInputs` / `@copilotOutputs` | Copilot | every action |
| `@copilotChannel` | Copilot | every webhook controller |
| `@copilotAuth` | Copilot | every webhook / action |
| `@adaptiveCard` | Copilot | every reply that uses an Adaptive Card |

---

## 3. Universal File Header Block

Every `.ts` / `.tsx` file (frontend, backend, copilot) MUST start with a doc-block **before the first import**.

```ts
/**
 * @file        <relative-path-from-src-root>
 * @module      <NestJSModule | FrontendArea | CopilotModule>
 * @layer       <controller|service|repository|dto|entity|guard|filter|interceptor|pipe|
 *               routing|presentation|feature|hooks|services|store|types|context|styles|
 *               copilot-topic|copilot-action|copilot-connector>
 *
 * @description
 * (Imperative one-paragraph summary of what this file does and why it exists.)
 *
 * @frd                <FRD-…>            // or TBD
 * @epic               <EPIC-…>           // or TBD
 * @userStory          <US-…>, <US-…>     // or TBD
 * @subTask            <ST-…>, <ST-…>     // or TBD
 * @rtmId              <RTM-…>            // optional
 * @acceptanceCriteria
 *  - AC-1: …
 *  - AC-2: …
 *  - AC-3: …
 *
 * @frdContext
 * (3–10 sentences condensed from the source FRD / EPIC / User Story.
 *  Cover actor, goal, business rule, edge cases, NFRs.)
 *
 * @author      <Name> <email>
 * @version     1.0.0
 * @since       <ISO date>
 */
```

---

## 4. Universal JSDoc / TSDoc Tag Reference

| Tag | Applies To | Purpose | Required? |
|-----|------------|---------|-----------|
| `@description` | file / class / method / component | What & why | Required |
| `@frd` / `@epic` / `@userStory` / `@subTask` | every artefact | RTM — `TBD` if unknown | **Required** |
| `@frdContext` | file / class / component | Prose summary of FRD/Story | **Required** |
| `@acceptanceCriteria` | file / class / method | AC satisfied here | Required |
| `@param` | method | Each parameter | Required |
| `@returns` | method | Resolved value semantics | Required |
| `@throws` | method | Every error the caller must handle | Required |
| `@example` | class / method / component | Runnable usage snippet | Recommended |
| `@async` | method | Explicit async marker | Convention |
| `@private` / `@protected` | method / field | Intent marker | Convention |
| `@deprecated` | class / method | Migration path + removal version | When applicable |
| `@see` | any | Link to related symbol | When applicable |
| `@since` | class / method | Version or ISO date introduced | Recommended |
| `@implements` | class | Interface implemented | When applicable |
| `@security` | route / component | Authn / authz / PII | Required at boundaries |
| `@idempotent` | mutation route | Idempotency contract | Required |
| `@sla` / `@nfr` | service / route | Latency/throughput targets | When applicable |
| `@a11y` | component | a11y notes | Required for UI |
| `@perf` | component / hook | memoisation notes | When applicable |
| `@copilot*` | copilot artefacts | per Section 2.3 | Required (copilot) |

> **TypeScript types and JSDoc types** — never duplicate the type in `@param` prose. Write business semantics: `@param customerId — UUID v4 of the customer to look up`.

---

# PART A — FRONTEND (Next.js + React + RTK Query)

## 5. Frontend File Header & Layers

Allowed `@layer` values for frontend: `routing`, `presentation`, `feature`, `hooks`, `services`, `store`, `types`, `context`, `styles`.

`@file` path is relative to the frontend `src/` root.

## 6. React Component Documentation

Every React component MUST document: (a) component-level intent + RTM, (b) every prop in the `Props` interface (inline `/** */`), (c) `@a11y` notes, (d) every public handler.

```tsx
/**
 * Props for {@link OrderDocument}.
 *
 * @frd        FRD-3.2.4
 * @userStory  US-DASH-07-05
 */
export interface OrderDocumentProps {
  /** Conversation the order is being attached to. UUID v4. */
  conversationId: string;
  /** Initial values when re-opening a draft. Optional. */
  initialValues?: Partial<OrderDocumentRequest>;
  /** Fired after a successful submit; parent typically closes the dialog. */
  onSubmitted: (id: string) => void;
}

/**
 * Renders the Order-Document creation form.
 *
 * @description
 * Collects document type, jurisdiction, and instructions, then dispatches
 * the createOrderDocument mutation. Loading and error states surface inline.
 *
 * @frd                FRD-3.2.4
 * @epic               EPIC-DASH-07
 * @userStory          US-DASH-07-05
 * @subTask            ST-DASH-07-05-02
 * @acceptanceCriteria AC-1, AC-2, AC-3
 *
 * @frdContext
 * Per FRD-3.2.4, an Order Document is a billable request tied to an
 * existing conversation. It MUST be gated by an active plan; without one,
 * the submit button is disabled and an "Upgrade plan" CTA is shown.
 *
 * @a11y
 * - Form is labelled with aria-labelledby="order-doc-title"
 * - Inputs have visible <label> elements
 * - Error messages use role="alert" and aria-live="polite"
 *
 * @perf submit handler memoised with useCallback
 *
 * @example
 * <OrderDocument conversationId={conv.id} onSubmitted={(id) => closeDialog(id)} />
 *
 * @since 2026-04-27
 */
export const OrderDocument: FC<OrderDocumentProps> = (props) => { /* … */ };
```

### 6.1 Component rules

1. Functional components + hooks. Class components only when an external API mandates them.
2. One named export per file; component name = file name (PascalCase).
3. Props interface in same file, named `<Component>Props`.
4. All props documented inline with TSDoc.
5. **No `fetch`/`axios`** — use RTK Query hooks from `features/`.
6. **No business logic in JSX** — extract to handlers or hooks.
7. `@a11y` mandatory for every interactive component.

## 7. Custom Hook Documentation

```ts
/**
 * Debounces a fast-changing value to a stable one.
 *
 * @template T
 * @param value   - Fast-changing source value
 * @param delayMs - Debounce window in ms (default 300)
 * @returns The stabilised value
 *
 * @frd                FRD-3.5.1
 * @epic               EPIC-DASH-09
 * @userStory          US-DASH-09-02
 * @subTask            ST-DASH-09-02-04
 * @acceptanceCriteria AC-2 search fires at most once per 300ms
 *
 * @frdContext
 * Per FRD-3.5.1, library search must not call the backend on every keystroke;
 * AC defines a 300ms debounce. Every search input enforces it via this hook.
 *
 * @example
 * const debounced = useDebounce(query, 300);
 *
 * @since 2026-04-27
 */
export function useDebounce<T>(value: T, delayMs = 300): T { /* … */ }
```

## 8. RTK Query Slice Documentation

```ts
/**
 * @file features/orderdocument/orderdocumentapi.ts
 * @module OrderDocumentFeature
 * @layer feature
 *
 * @description RTK Query endpoints for the backend `orderdocument` controller.
 * One endpoint = one HTTP route = one RTM row.
 *
 * @frd       FRD-3.2.4
 * @epic      EPIC-DASH-07
 * @userStory US-DASH-07-05, US-DASH-07-06
 * @subTask   ST-DASH-07-05-01, ST-DASH-07-06-01
 *
 * @frdContext
 * Frontend needs create, getById, list. update/delete are out-of-scope per US-DASH-07-05.
 *
 * @since 2026-04-27
 */
export const orderDocumentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Creates a new Order Document.
     *
     * @async
     * @param body - Validated payload
     * @returns OrderDocumentResponse with server-assigned id
     * @throws RTK Query rejection on 4xx/5xx
     *
     * @frd                FRD-3.2.4
     * @userStory          US-DASH-07-05
     * @subTask            ST-DASH-07-05-01
     * @acceptanceCriteria AC-1 valid → 201; AC-3 server error → toast
     */
    createOrderDocument: build.mutation<OrderDocumentResponse, OrderDocumentRequest>({
      query: (body) => ({ url: '/order-documents', method: 'POST', body }),
      invalidatesTags: ['OrderDocument'],
    }),
  }),
});
```

**RTK Query rules:** ONE `baseApi`, all features `injectEndpoints`. Tag types declared once on `baseApi`. Auth/refresh in `baseQuery`, never in feature files.

## 9. Redux Slice Documentation

```ts
/**
 * UI slice for the dashboard shell.
 *
 * @frd                FRD-2.1
 * @epic               EPIC-DASH-01
 * @userStory          US-DASH-01-04
 * @subTask            ST-DASH-01-04-02
 * @acceptanceCriteria AC-1 collapse persists across nav; AC-2 reset on logout
 *
 * @frdContext Per US-DASH-01-04, sidebar state persists per session, resets on logout.
 *
 * @since 2026-04-27
 */
export const uiSlice = createSlice({ /* … */ });
```

## 10. Page (`app/**/page.tsx`) Documentation

`page.tsx` MUST be **thin** — composes components, calls RTK Query hooks. The header is the only place the route URL is documented.

```tsx
/**
 * @file        app/Dashboard/newconversation/page.tsx
 * @route       /Dashboard/newconversation
 * @module      DashboardModule / NewConversationSubModule
 * @layer       routing
 *
 * @frd                FRD-3.2
 * @epic               EPIC-DASH-07
 * @userStory          US-DASH-07-01, US-DASH-07-05
 * @subTask            ST-DASH-07-01-01, ST-DASH-07-05-01
 * @acceptanceCriteria AC-1 renders for authenticated users; AC-2 redirects to /Auth/login otherwise
 *
 * @frdContext Primary entry point for placing a research/order request. Auth-gated.
 *
 * @since 2026-04-27
 */
```

## 11. Frontend State Management & Frontend Type Documentation

- Server data → RTK Query (never `useState`)
- Client UI state → Redux slice when shared, otherwise local `useState`
- Auth + theme + locale → React Context
- Form state → react-hook-form (or equivalent)
- No prop drilling deeper than 2 levels

DTO/types in `types/*.types.ts` mirror backend DTOs and document each field inline with `/** */`.

---

# PART B — BACKEND (NestJS + Node.js)

## 12. Backend File Header & Layers

Allowed `@layer` values for backend: `controller`, `service`, `repository`, `dto`, `entity`, `interface`, `module`, `guard`, `filter`, `interceptor`, `pipe`, `enum`, `util`, `transformer`, `constants`, `migration`.

## 13. DTO & Interface Documentation

```ts
/**
 * Data Transfer Object representing a Customer record.
 * Returned by the service layer — never expose the ORM entity directly.
 *
 * @frd       FRD-4.1
 * @userStory US-CRM-02-01
 * @subTask   ST-CRM-02-01-03
 *
 * @frdContext Public Customer shape exposes id, name, email, E.164 phone only.
 *
 * @since 1.0.0
 */
export interface CustomerDTO {
  /** UUID v4 unique identifier. */
  id: string;
  /** Given name. */
  firstName: string;
  /** Validated on write. */
  email: string;
  /** E.164 — @example '+447700900000' */
  phoneNumber: string;
}
```

## 14. Service Interface (DI Contract) + Implementation

Define the contract first; the concrete service `@implements` it. Consumers depend on the **token + interface**, never the concrete class.

```ts
/**
 * Contract for the Customer Service layer.
 *
 * @frd FRD-4.1  @epic EPIC-CRM-02  @userStory US-CRM-02-01, US-CRM-02-04
 *
 * @frdContext Customer data exposed as a stable interface. Soft-deleted excluded by default.
 *            Batch caps at 500 IDs per AC-2.
 *
 * @example
 * @Inject(CUSTOMER_SERVICE_TOKEN)
 * private readonly customerService: ICustomerService
 *
 * @since 1.0.0
 */
export interface ICustomerService {
  /**
   * Fetches full details for a batch.
   *
   * @async
   * @param customerIds Non-empty array of UUID v4 (max 500)
   * @returns CustomerDTO[] in input order
   * @throws {InvalidArgumentException} customerIds null/empty/oversized
   * @throws {CustomerServiceException} data-source failure
   *
   * @frd                FRD-4.1
   * @userStory          US-CRM-02-01
   * @subTask            ST-CRM-02-01-03
   * @acceptanceCriteria AC-2 supports 1..500 IDs
   * @nfr                P95 < 150ms for batch ≤ 100
   */
  getCustomerDetails(customerIds: string[]): Promise<CustomerDTO[]>;
}
```

Implementation class doc-block lists **design decisions** explicitly:

```ts
/**
 * @description Concrete ICustomerService. Maps entities to DTOs.
 *
 * Design decisions:
 *  - Overloaded getCustomerDetails mirrors original Java surface
 *  - Guard helpers keep validation DRY
 *  - wrapRepositoryError centralises error logging
 *  - toDTO is pure — trivially unit-testable
 *
 * @implements         {ICustomerService}
 * @frd                FRD-4.1
 * @userStory          US-CRM-02-01, US-CRM-02-04
 * @acceptanceCriteria AC-1, AC-2, AC-3
 *
 * @frdContext Canonical implementation backing Customer reads. Never exposes ORM entity.
 *
 * @since 1.0.0
 */
@Injectable()
export class CustomerService implements ICustomerService { /* … */ }
```

Public methods use `{@inheritDoc}` to inherit prose from the interface; private helpers carry their own RTM block.

## 15. Controller Documentation

```ts
/**
 * REST controller for the Customer resource. Base route /api/v1/customers.
 *
 * @controller customers
 * @uses       {JwtAuthGuard} — all endpoints require valid JWT
 * @frd FRD-4.1  @epic EPIC-CRM-02  @userStory US-CRM-02-01, US-CRM-02-04
 *
 * @frdContext Public REST surface. Role determines field-level visibility (FRD-4.1.5).
 *
 * @since 1.0.0
 */
@Controller('api/v1/customers')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(@Inject(CUSTOMER_SERVICE_TOKEN) private readonly svc: ICustomerService) {}

  /**
   * GET /api/v1/customers/:id
   *
   * @async
   * @param id UUID v4 path param
   * @returns CustomerDTO (200)
   * @throws {InvalidArgumentException} 400
   * @throws {CustomerNotFoundException} 404
   * @throws {CustomerServiceException}  500
   *
   * @frd                FRD-4.1
   * @userStory          US-CRM-02-04
   * @acceptanceCriteria AC-3 missing ID → 404
   * @security           JWT required; role-filtered fields per FRD-4.1.5
   * @idempotent         GET — naturally idempotent
   * @nfr                P95 < 150ms
   */
  @Get(':id')
  async getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<CustomerDTO> {
    return this.svc.getCustomerDetails(id);
  }
}
```

**Controller rules:**
1. Thin — only validate request shape and delegate.
2. Inject via `@Inject(<TOKEN>)` against the **interface**.
3. Every route lists every `@throws` mapped to its HTTP status.
4. Every mutation route carries `@idempotent`.
5. Every route carries `@security`.

## 16. Module / Entity / Exception Documentation

Modules wire controllers, providers, and exports — RTM block names the EPIC + sub-tasks. Entities document persistence concerns inline (`@Entity`, indices, soft-delete column). Exceptions document trigger condition + HTTP status + usage example.

## 17. Backend Error Handling & Logging

- Domain exceptions extend NestJS `HttpException`; map to known HTTP status.
- Validation via `class-validator` + `ValidationPipe` → 400.
- Unknown errors wrapped in a domain exception preserving the cause; `this.logger.error(... , error.stack)`.
- A single `AllExceptionsFilter` produces a uniform error envelope `{ success:false, code, message, traceId }`.
- Every catch block includes RTM IDs in the structured log payload.
- Levels: `debug` (entry/exit, dev-only), `log` (business events), `warn` (recoverable), `error` (with stack).
- **Never `console.log`** in committed code.

## 18. Backend Migrations

One file per table under `database/migration/`. Every migration carries an RTM block. Migrations are forward-only in production; rollback = a new forward migration.

---

# PART C — COPILOT STUDIO INTEGRATION

## 19. Copilot Studio Module Layout

The Copilot integration lives in a dedicated NestJS module: `apps/copilot/`.

```
apps/copilot/
└── src/
    ├── module.ts
    ├── main.ts
    ├── controller/
    │   └── copilot.webhook.controller.ts      # webhook entry
    ├── service/
    │   └── copilot.dispatcher.service.ts      # routes topic/action → domain svc
    ├── topics/                                # one file per Studio topic
    │   ├── greeting.topic.ts
    │   └── createorder.topic.ts
    ├── actions/                               # one file per Studio custom action
    │   ├── lookupcustomer.action.ts
    │   └── createorderdocument.action.ts
    ├── connectors/                            # Power Platform custom connector OpenAPI
    │   └── crm.connector.ts
    ├── dto/
    │   ├── activity.dto.ts                    # Bot Framework Activity
    │   ├── adaptivecard.dto.ts                # Adaptive Card payloads
    │   └── action-context.dto.ts
    ├── guards/copilot-signature.guard.ts      # HMAC validation
    ├── interceptors/conversation-trace.interceptor.ts
    ├── enum/topic-name.enum.ts
    ├── utils/adaptive-card.util.ts
    ├── transformer/activity.transformer.ts
    └── constants/copilot.constants.ts
```

## 20. Copilot-Specific JSDoc Tags

`@copilotTopic`, `@copilotAction`, `@copilotIntent`, `@copilotInputs`, `@copilotOutputs`, `@copilotChannel`, `@copilotAuth`, `@adaptiveCard`. See Section 2.3 for usage.

### 20.1 Webhook controller

```ts
/**
 * @file copilot.webhook.controller.ts
 * @module CopilotModule
 * @layer controller
 *
 * @description Single inbound endpoint for Copilot Studio / Bot Framework activities.
 *              Validates HMAC, normalises Activity, dispatches to topic/action handlers.
 *
 * @frd FRD-7.1  @epic EPIC-COPILOT-01
 * @userStory US-COPILOT-01-01, US-COPILOT-01-02
 *
 * @copilotChannel Teams, M365 Copilot, web (Direct Line)
 * @copilotAuth    HMAC + (optional) bearer for outbound user context
 *
 * @frdContext
 * Bot lets users trigger backend workflows (lookup customer, create order document)
 * from Teams/M365 Copilot. Unknown topics return a generic fallback Adaptive Card.
 *
 * @since 2026-04-27
 */
@Controller('api/v1/copilot')
@UseGuards(CopilotSignatureGuard)
export class CopilotWebhookController {
  /**
   * POST /api/v1/copilot/messages — receives a Bot Framework Activity.
   *
   * @async
   * @param activity Validated Activity payload
   * @returns Reply Activity (text or Adaptive Card) or void (ack-only)
   * @throws {InvalidSignatureException}    401
   * @throws {UnsupportedActivityException} 400
   * @throws {CopilotDispatchException}     500
   *
   * @frd FRD-7.1  @userStory US-COPILOT-01-01  @subTask ST-COPILOT-01-01-01
   * @acceptanceCriteria AC-1 valid → 200; AC-2 bad sig → 401; AC-4 unknown topic → fallback card
   * @security           HMAC validated; PII masked in logs
   * @idempotent         activity.id used as idempotency key
   * @copilotChannel     Teams, M365 Copilot, web
   */
  @Post('messages')
  async receive(@Body() activity: ActivityDto): Promise<ActivityDto | void> { /* … */ }
}
```

### 20.2 Topic handler

```ts
/**
 * Handles the "Create Order" topic.
 *
 * @copilotTopic   create_order
 * @copilotIntent  "I want to place an order", "create order", "raise a new request"
 * @copilotAuth    User-passed (uses calling user's bearer token)
 *
 * @frd FRD-7.1.3  @userStory US-COPILOT-01-02
 * @acceptanceCriteria AC-1 happy → confirmation card; AC-2 no plan → upgrade card; AC-3 backend error → retryable
 *
 * @frdContext Gathers order params via Adaptive Cards, calls OrderDocument service.
 *            Active plan required; without one, "Upgrade plan" card is returned.
 *
 * @since 2026-04-27
 */
@Injectable()
export class CreateOrderTopic implements ICopilotTopic { /* … */ }
```

### 20.3 Custom action

```ts
/**
 * Custom action: lookup_customer
 *
 * @copilotAction  lookup_customer
 * @copilotInputs  customerId: string (UUID v4) — required
 * @copilotOutputs found: boolean, displayName: string, planActive: boolean
 * @copilotAuth    Service-Principal
 *
 * @frd FRD-7.1.4  @userStory US-COPILOT-01-03
 * @acceptanceCriteria AC-1 valid → outputs populated; AC-2 not found → found=false (no exception)
 *
 * @frdContext Side-effect-free lookup. Translates not-found into outputs (no throw)
 *            so Studio author branches on `found` without try/catch.
 *
 * @since 2026-04-27
 */
@Injectable()
export class LookupCustomerAction implements ICopilotAction<LookupInput, LookupOutput> { /* … */ }
```

### 20.4 Copilot rules

1. **Topic/action names in code MUST match Studio config exactly.** Pre-commit hook checks `copilot/topics.manifest.json`.
2. **No business logic in topics/actions** — thin adapters over existing domain services.
3. **All inbound activities are signature-verified** by `CopilotSignatureGuard`.
4. **Idempotency:** treat `activity.id` as the idempotency key; replays MUST NOT duplicate side-effects.
5. **PII masking** by `ConversationTraceInterceptor` (`from.id`, `text`, `attachments`).
6. **Adaptive Cards** built via `utils/adaptive-card.util.ts`; never inline JSON.
7. **Outbound to Microsoft Graph / Dataverse** through `lib/dmz/`, never directly from a topic/action.
8. **Every topic and action carries the full RTM block + Copilot-specific tags.**

---

# PART D — CROSS-CUTTING

## 21. Naming Conventions (Universal)

| Construct | Convention | Example |
|-----------|------------|---------|
| Frontend route folder (top) | PascalCase | `Dashboard`, `Auth` |
| Frontend route folder (sub) | lowercase / kebab-case | `newconversation`, `terms-and-policies` |
| Frontend page file | always `page.tsx` | `page.tsx` |
| Frontend component | PascalCase, `.tsx` | `OrderDocument.tsx` |
| Frontend hook | `useXxx.ts`, camelCase | `useDebounce.ts` |
| Frontend Context | `XxxContext.tsx` | `AuthContext.tsx` |
| Frontend RTK slice | `<slug>api.ts` | `orderdocumentapi.ts` |
| Frontend Redux slice | `<feature>Slice.ts` | `uiSlice.ts` |
| Frontend types | `<area>.types.ts` | `api.types.ts` |
| Backend file | `<slug>.<artefact>.ts` | `customer.service.ts` |
| Backend module class | `<Slug>Module` | `CustomerModule` |
| Backend service class | `<Slug>Service` | `CustomerService` |
| Backend service interface | `I<Slug>Service` | `ICustomerService` |
| Backend DI token | `UPPER_SNAKE_CASE_TOKEN` | `CUSTOMER_SERVICE_TOKEN` |
| Backend controller | `<Slug>Controller` | `CustomerController` |
| Backend DTO | `<Slug><Action>Dto` | `CustomerCreateDto` |
| Backend entity | `<Slug>Entity` | `CustomerEntity` |
| Backend exception | `<Slug><Reason>Exception` | `CustomerNotFoundException` |
| Backend migration | `create.<table>.js` | `create.customer.js` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_BATCH_SIZE` |
| Variables / methods | `camelCase` | `fetchSingleCustomer` |
| Boolean prop / field | `isXxx` / `hasXxx` / `canXxx` | `isLoading`, `hasActivePlan` |
| Event handler prop | `onXxx` | `onSubmitted` |
| Copilot topic class | `<TopicName>Topic` (PascalCase) | `CreateOrderTopic` |
| Copilot action class | `<ActionName>Action` | `LookupCustomerAction` |
| Copilot topic file | `<topic>.topic.ts` | `createorder.topic.ts` |
| Copilot action file | `<action>.action.ts` | `lookupcustomer.action.ts` |

## 22. Universal Error Handling

- Domain errors are typed (Frontend) or extend NestJS `HttpException` (Backend).
- Never silence unknown errors:
  ```ts
  // ❌ throw new ServiceException('Something went wrong');
  this.logger.error(`Error in ${method}`, error instanceof Error ? error.stack : error);
  throw new ServiceException(`Failed during ${method}`, error);
  ```
- Frontend surfaces RTK Query rejection via `error` state — recoverable UI required.
- Top-level routes wrapped in error boundaries (Next.js `error.tsx`); backend in `AllExceptionsFilter`.
- **Catch blocks log RTM IDs**: `{ rtm: { frd, userStory }, ...context }`.

## 23. Universal Logging

| Level | Use for |
|-------|---------|
| `debug` | entry/exit (dev only, stripped in prod) |
| `log`   | significant business events |
| `warn`  | recoverable anomalies |
| `error` | exceptions with stack trace |

- **No `console.*`** in committed code; use a logger wrapper (`lib/logger.ts` on FE, NestJS scoped `Logger` on BE).
- Mask any field whose name matches `/(pass|secret|token|key)/i`.

## 24. Universal Security

- **Secrets**: never read `process.env` outside `config/`. Required envs throw at boot.
- **Input validation**: at every system boundary — `class-validator` (BE), `zod`/`react-hook-form` (FE).
- **No `dangerouslySetInnerHTML`** unless sanitised with DOMPurify + an `@security` note.
- **Tokens**: never in `localStorage`. httpOnly cookies set by the backend.
- **Copilot HMAC**: verified by `CopilotSignatureGuard` on every inbound webhook.
- **PII in logs**: masked by interceptors. Components/routes handling PII carry `@security`.
- **Copilot outbound** to Graph/Dataverse through `lib/dmz/` — never inline.

## 25. Universal Testing

| Layer | Frameworks | Coverage |
|-------|-----------|---------:|
| Frontend unit / component | Vitest or Jest + React Testing Library | ≥80% |
| Frontend E2E | Playwright (preferred) or Cypress | critical flows |
| Backend unit | Jest | ≥80% |
| Backend integration | Jest + `Test.createTestingModule` + Testcontainers | controllers + DI graph |
| Backend E2E | Supertest | public REST surface |
| Copilot turn | Bot Framework Emulator scripted turns | every topic happy + AC-2/AC-3 |

Every test's `describe` block carries the RTM:

```ts
describe('CustomerController.getById [FRD-4.1 / US-CRM-02-04 / ST-CRM-02-04-02]', () => { /* … */ });
```

Lint rule `local/require-rtm-tags-on-tests` fails CI when missing.

## 26. LLD Checklist (use when generating an LLD document)

The LLD generator MUST produce, for each artefact in scope:

- [ ] **Identification** — file path, layer, module
- [ ] **RTM block** — `@frd`, `@epic`, `@userStory`, `@subTask`, `@acceptanceCriteria` (TBD where unknown)
- [ ] **`@frdContext`** — 3–10 sentence prose summary of business intent
- [ ] **Public contract** — class signature + method signatures with full param/return/throws
- [ ] **Inputs/outputs** — DTOs and types referenced
- [ ] **Dependencies** — DI tokens consumed (BE), hooks consumed (FE), Copilot manifest entries (Copilot)
- [ ] **Error model** — every `@throws` with HTTP status (BE) or recovery UI (FE)
- [ ] **Security model** — `@security` block; auth mode; PII handling
- [ ] **Idempotency** (mutations) — `@idempotent` block
- [ ] **NFR** — `@sla`/`@nfr`/`@perf` blocks where applicable
- [ ] **A11y** (FE UI) — `@a11y` block
- [ ] **Sequence / data flow** — Mermaid sequence diagram for non-trivial flows
- [ ] **Test plan** — per-AC list of tests (unit / integration / E2E / Copilot turn)
- [ ] **Open questions** — explicit list of `TBD` items to be resolved

## 27. PR Checklist (use when generating source code)

- [ ] File header per Section 3 with all RTM tags + `@frdContext`
- [ ] Every public class, method, component, hook, slice, route, topic, action has its own RTM block
- [ ] No file > 400 lines, no class/component > 250, no method > 30
- [ ] Constructors ≤ 3 deps (BE)
- [ ] Props/types fully documented with inline `/** */`
- [ ] Frontend: `@a11y` on every interactive component; no `fetch`/`axios` outside `services/baseapi.ts`
- [ ] Backend: every route lists every `@throws` with HTTP status; every mutation has `@idempotent`; every route has `@security`
- [ ] Copilot: topic/action names match `topics.manifest.json`; no business logic in handlers; `activity.id` used as idempotency key
- [ ] No `console.*`; catch blocks log RTM IDs
- [ ] Tests carry RTM IDs in `describe`; coverage ≥ 80%
- [ ] ESLint, Prettier, type-check, `local/require-rtm-tags` rule all green
- [ ] All `TBD` tags accompanied by `// TODO(rtm)` so they are greppable

---

## 28. Universal Tooling

| Tool | Purpose | Scope |
|------|---------|-------|
| `eslint` + `@typescript-eslint` + `eslint-plugin-jsdoc` | Linting + RTM enforcement | FE + BE + Copilot |
| `local/require-rtm-tags` | Custom rule — fail CI on missing RTM tags | FE + BE + Copilot |
| `local/require-rtm-tags-on-tests` | Custom rule — RTM in `describe` | FE + BE + Copilot |
| `prettier` | Formatting | All |
| `typescript --strict` | Type safety | All |
| `husky` + `lint-staged` | Pre-commit gates | All |
| `typedoc` | API site generation | All |
| `vitest`/`jest` | Unit + component tests | FE / BE / Copilot |
| `playwright` | Frontend E2E | FE |
| `supertest` | Backend E2E | BE |
| `bot-framework-emulator` | Copilot turn replay | Copilot |
| `@nestjs/testing` + Testcontainers | Backend integration | BE |

---

## 29. AI Generation Rules — TL;DR

When the AI generates LLD or code:

1. **Always include the file header** (Section 3).
2. **Always include all RTM tags** (Section 2). Use `TBD` + `// TODO(rtm)` when unknown.
3. **Always include `@frdContext`** prose.
4. **Apply length limits** (Section 1.1).
5. **Apply layer rules**: Frontend §5–11, Backend §12–18, Copilot §19–20.
6. **Apply cross-cutting rules**: Naming §21, Errors §22, Logging §23, Security §24, Testing §25.
7. **Run the LLD checklist** (Section 26) for LLD outputs; **PR checklist** (Section 27) for code outputs.
8. **Mirror frontend ↔ backend ↔ copilot**: a backend module typically produces (a) one feature folder on the frontend with an RTK Query slice, (b) one set of `app/<area>/<sub>/page.tsx` route + `components/<sub>/`, (c) optionally one Copilot topic + one or more Copilot custom actions.
9. **Never invent folders** outside the structure templates.
10. **Never produce code without RTM tags** — even for the smallest utility.

---

## 30. References

- *Backend-FolderStructure-Template.md* — canonical NestJS folder layout
- *Frontend-FolderStructure-Template.md* — canonical Next.js folder layout
- *Frontend-CodingStandards.md* — frontend deep dive
- *Backend-CodingStandards.md* — backend + Copilot deep dive
- Internal *JSDoc Standards for NestJS & Node.js v1.0.0*
- Internal *CodingStandards-python.md* (style discipline aligned across stacks)
- Microsoft Bot Framework Activity Schema (v3)
- Microsoft Copilot Studio — Topics, Actions, Custom Connectors documentation
- Adaptive Cards Schema (1.5+)

---

**End of Combined Coding Standards v1.0.0.**
