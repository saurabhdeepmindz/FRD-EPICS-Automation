# Frontend Coding Standards

> **Stack:** Next.js (App Router) + React 18+ + TypeScript 5+ + Redux Toolkit / RTK Query
> **Style System:** TSDoc / JSDoc with mandatory RTM (Requirements Traceability Matrix) tags
> **Audience:** All frontend engineers, AI code generators, interns and juniors performing maintenance
> **Applies to:** every `.ts` / `.tsx` file under the frontend `src/` tree (see *Frontend-FolderStructure-Template.md*)
> **Version:** 1.0.0

---

## 1. Core Philosophy

Documentation is a first-class citizen. Every public-facing symbol — page, component, hook, RTK Query slice, context, util, type — must be documented **before it is merged**.

Two non-negotiable goals govern every comment we write:

1. **Traceability** — every class, component, and method MUST trace back to the FRD / EPIC / User Story / Sub-Task that justifies its existence. If traceability is unknown at the time of writing, the value MUST be the literal string **`TBD`** (not blank, not removed) so that reviewers immediately spot the gap.
2. **Hand-off readiness** — the descriptions must be detailed enough that an intern or junior engineer joining six months later can understand *what* the code does, *why* it exists, and *how* it integrates, **without reading the implementation**. The relevant prose from the FRD / EPIC / User Story / Sub-Task MUST be summarised in the doc block — not just referenced by ID.

| Limit | Value | Applies to |
|-------|-------|------------|
| Max file length | 400 lines | any `.ts`/`.tsx` (excluding imports) |
| Max component / class length | 250 lines | React components, classes |
| Max function / method length | 30 lines | hooks, handlers, utilities |
| Max props on a component | 5 | beyond 5, group into a typed object |
| Max parameters on a function | 4 | beyond 4, use a typed object |
| Max nesting depth | 3 | `if` / `try` / `for` / JSX nesting |
| Max JSX depth in one component | 4 | extract a child component beyond this |

**Golden rule:** If you exceed any limit, extract a sub-component, extract a custom hook, or split the file. The limits exist to protect the next developer.

---

## 2. The RTM Traceability Block (MANDATORY)

Every **file**, **component**, **class**, **public method/function**, **hook**, and **RTK Query endpoint** MUST carry the following traceability tags. Use `TBD` whenever the value is not yet known — never omit the tag.

### 2.1 Standard tags

| Tag | Purpose | Example | If unknown |
|-----|---------|---------|------------|
| `@frd` | Functional Requirements Document section | `@frd FRD-2.4.1 — User can create a new conversation` | `@frd TBD` |
| `@epic` | EPIC ID + title | `@epic EPIC-DASH-07 — Conversation Lifecycle` | `@epic TBD` |
| `@userStory` | User Story ID + Gherkin-style summary | `@userStory US-DASH-07-03 — As a user I want to start a new conversation so that…` | `@userStory TBD` |
| `@subTask` | Sub-Task ID(s) implemented in this file/method | `@subTask ST-DASH-07-03-12, ST-DASH-07-03-13` | `@subTask TBD` |
| `@rtmId` | Optional consolidated RTM row ID | `@rtmId RTM-FE-00421` | `@rtmId TBD` |
| `@acceptanceCriteria` | One-line summary (or bulleted list) of the AC this code satisfies | `@acceptanceCriteria AC-1 valid input → 201; AC-2 dup email → 409` | `@acceptanceCriteria TBD` |

### 2.2 The mandatory `@frdContext` block

In addition to the above IDs, every file-level and class-level header MUST include a prose block that **summarises the relevant FRD / EPIC / User Story content** so that maintainers do not have to chase the original document. This is the most important rule for intern/junior maintainability.

```ts
/**
 * @frdContext
 * (Copy/condense the relevant FRD / EPIC / User Story / Sub-Task narrative here so
 *  a future maintainer understands the business intent without leaving the file.
 *  3–10 sentences. Cover: actor, goal, business rule, edge cases, NFRs.)
 */
```

If the source narrative is unavailable, write `@frdContext TBD — to be backfilled when RTM is finalised.` and add a `// TODO(rtm)` comment so it is greppable.

---

## 3. File Header Block

Every `.ts` / `.tsx` file MUST start with a TSDoc header **before the first import**.

```ts
/**
 * @file        components/newconversation/OrderDocument.tsx
 * @module      DashboardModule / NewConversationSubModule
 * @layer       presentation               // routing | presentation | feature | hooks | services | store | types
 *
 * @description
 * UI component that renders the "Order Document" panel inside the
 * "New Conversation" sub-module. Allows the user to specify document
 * metadata, attach files, and dispatch the order to the backend via
 * the orderdocument RTK Query mutation.
 *
 * @frd                  FRD-3.2.4 — Order document creation flow
 * @epic                 EPIC-DASH-07 — Conversation Lifecycle
 * @userStory            US-DASH-07-05 — As a logged-in user I want to attach an order document so that…
 * @subTask              ST-DASH-07-05-02, ST-DASH-07-05-03
 * @rtmId                RTM-FE-00428
 * @acceptanceCriteria
 *  - AC-1: Form submits successfully when all required fields are filled
 *  - AC-2: Validation errors are shown inline within 100ms
 *  - AC-3: Successful submit closes the dialog and refreshes the list
 *
 * @frdContext
 * Per FRD-3.2.4, an Order Document represents a paid request the user
 * is placing against a verified conversation. It must capture the
 * document type, jurisdiction, and any free-text instructions. The
 * backend rejects requests for users without an active plan; the UI
 * MUST therefore disable the submit button when `useAuth().hasActivePlan === false`
 * and surface a "Upgrade plan" CTA. Refer to EPIC-DASH-07 for the
 * complete conversation lifecycle and US-DASH-07-05 for the AC list.
 *
 * @author      <Name> <email>
 * @version     1.0.0
 * @since       2026-04-27
 */
```

**Rules:**
- The `@layer` value MUST be one of: `routing`, `presentation`, `feature`, `hooks`, `services`, `store`, `types`, `context`, `styles`.
- The path on `@file` is relative to the frontend src root.
- `@frdContext` is REQUIRED. It is the most useful block for juniors.

---

## 4. TSDoc / JSDoc Tag Reference

| Tag | Applies To | Purpose | Required? |
|-----|------------|---------|-----------|
| `@description` | file / component / class / method | What & why | Required |
| `@frd` / `@epic` / `@userStory` / `@subTask` | file / component / class / method | RTM traceability — `TBD` if unknown | **Required** |
| `@frdContext` | file / class | Prose summary of FRD/EPIC/Story for maintainers | **Required** |
| `@acceptanceCriteria` | file / component / method | Acceptance criteria satisfied here | Required |
| `@param` | method | Each parameter; `[name]` for optional | Required |
| `@returns` | method | Describe the resolved value, not just the type | Required |
| `@throws` | method | Every error the caller must handle | Required |
| `@example` | component / method | A runnable usage snippet | Recommended |
| `@async` | method | Explicit async marker | Convention |
| `@private` / `@protected` | method / field | Intent marker alongside TS keywords | Convention |
| `@deprecated` | component / method | Migration path + removal version | When applicable |
| `@see` | any | Link to related symbol or doc | When applicable |
| `@since` | file / class / method | Version or ISO date introduced | Recommended |
| `@a11y` | component | Accessibility notes (ARIA roles, keyboard, contrast) | Required for UI |
| `@perf` | component / hook | Memoisation / re-render notes | When applicable |
| `@security` | component / endpoint | XSS / authz / PII concerns | When applicable |

> **TypeScript types and TSDoc types** — never duplicate the type in `@param` prose. The type is already in the signature. Write business semantics instead: `@param customerId — UUID v4 of the customer to look up`.

---

## 5. React Component Documentation

Every React component MUST document: (a) the component-level intent + RTM block, (b) every prop in the `Props` interface, (c) accessibility expectations, (d) every public handler/method.

### 5.1 Functional component — full template

```tsx
/**
 * @file components/newconversation/OrderDocument.tsx
 * (file header per Section 3 — omitted here for brevity)
 */

import { FC, useCallback } from 'react';

import { useCreateOrderDocumentMutation } from '@/features/orderdocument/orderdocumentapi';
import type { OrderDocumentRequest } from '@/types/api.types';

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
 * The form collects document type, jurisdiction, and instructions, then
 * dispatches the createOrderDocument mutation. Loading and error states
 * are surfaced inline.
 *
 * @frd                FRD-3.2.4
 * @epic               EPIC-DASH-07
 * @userStory          US-DASH-07-05
 * @subTask            ST-DASH-07-05-02
 * @acceptanceCriteria AC-1, AC-2, AC-3 (see file header)
 *
 * @frdContext
 * Per FRD-3.2.4, an Order Document is the user's formal request for
 * billable work. It MUST be tied to an existing conversation and to a
 * user with an active plan. On submission failure (network/server),
 * the form keeps user input intact and surfaces a retryable error.
 *
 * @a11y
 * - Form is labelled with aria-labelledby="order-doc-title"
 * - All inputs have visible <label> elements
 * - Error messages use role="alert" and aria-live="polite"
 *
 * @perf
 * - submit handler is memoised with useCallback
 * - Component is wrapped in React.memo by the caller; props are stable refs
 *
 * @example
 * <OrderDocument
 *   conversationId={conv.id}
 *   onSubmitted={(id) => closeDialog(id)}
 * />
 *
 * @since 2026-04-27
 */
export const OrderDocument: FC<OrderDocumentProps> = ({
  conversationId,
  initialValues,
  onSubmitted,
}) => {
  const [createOrderDocument, { isLoading, error }] = useCreateOrderDocumentMutation();

  /**
   * Submits the form. Calls onSubmitted with the new ID on success.
   *
   * @async
   * @private
   * @param values - Validated form values (already passed schema validation)
   * @throws never — errors are surfaced via the `error` state, not thrown
   *
   * @frd       FRD-3.2.4
   * @userStory US-DASH-07-05
   * @subTask   ST-DASH-07-05-03
   */
  const handleSubmit = useCallback(
    async (values: OrderDocumentRequest) => {
      const result = await createOrderDocument({ conversationId, ...values }).unwrap();
      onSubmitted(result.id);
    },
    [conversationId, createOrderDocument, onSubmitted],
  );

  // … JSX …
  return null;
};
```

### 5.2 Component rules

1. **Prefer functional components + hooks.** Class components only when an external API mandates them.
2. **Single default-or-named export per file.** The component shares the file's name (PascalCase).
3. **Props interface lives in the same file**, named `<Component>Props`.
4. **All props documented inline** with TSDoc `/** */` on the line above the field.
5. **No business logic in JSX.** Extract to handlers or hooks.
6. **No `fetch` / `axios` calls.** Use the RTK Query hooks generated under `features/`.
7. **A11y is mandatory.** Every interactive component MUST have `@a11y` notes.
8. **Memoise expensive computations** with `useMemo`; memoise handlers with `useCallback` only when they are passed to memoised children.

---

## 6. Custom Hook Documentation

Custom hooks live under `Hooks/` and follow the same RTM rules. Hook names MUST start with `use`.

```ts
/**
 * Debounces a fast-changing value to a stable one.
 *
 * @description
 * Returns a value that lags `value` by `delayMs`. Used to throttle
 * search-as-you-type input before dispatching network calls.
 *
 * @template T
 * @param value   - The fast-changing source value
 * @param delayMs - Debounce window in milliseconds (default 300)
 * @returns The stabilised value
 *
 * @frd                FRD-3.5.1 (search input)
 * @epic               EPIC-DASH-09 — Library Search
 * @userStory          US-DASH-09-02 — As a user I want type-ahead search…
 * @subTask            ST-DASH-09-02-04
 * @acceptanceCriteria AC-2 (search fires at most once per 300ms)
 *
 * @frdContext
 * Per FRD-3.5.1, the library search must not call the backend on every
 * keystroke; the AC defines a 300ms debounce window. This hook centralises
 * that behaviour so every search input enforces it identically.
 *
 * @example
 * const debounced = useDebounce(query, 300);
 * useEffect(() => { fetch(debounced); }, [debounced]);
 *
 * @since 2026-04-27
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  // …
}
```

---

## 7. RTK Query Slice Documentation (`features/<module>/<module>api.ts`)

Each slice extends the single base API in `services/baseapi.ts`. Every endpoint MUST have its own RTM block — endpoints are the bridge to the backend and therefore the natural place to enforce traceability across the stack.

```ts
/**
 * @file features/orderdocument/orderdocumentapi.ts
 * @module OrderDocumentFeature
 * @layer feature
 *
 * @description
 * RTK Query endpoints for the backend `orderdocument` controller.
 * One endpoint = one HTTP route = one RTM row.
 *
 * @frd       FRD-3.2.4
 * @epic      EPIC-DASH-07
 * @userStory US-DASH-07-05, US-DASH-07-06
 * @subTask   ST-DASH-07-05-01, ST-DASH-07-06-01
 *
 * @frdContext
 * The orderdocument controller exposes CRUD over Order Documents. The
 * frontend ONLY needs create, getById, and list. update/delete are
 * out-of-scope for this sprint per US-DASH-07-05.
 *
 * @since 2026-04-27
 */

import { baseApi } from '@/services/baseapi';
import type {
  OrderDocumentRequest,
  OrderDocumentResponse,
  OrderDocumentListResponse,
} from '@/types/api.types';

export const orderDocumentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Creates a new Order Document.
     *
     * @async
     * @param body - Validated request payload
     * @returns The persisted OrderDocumentResponse with server-assigned id
     * @throws RTK Query rejection on 4xx/5xx — components surface via the `error` state
     *
     * @frd                FRD-3.2.4
     * @userStory          US-DASH-07-05
     * @subTask            ST-DASH-07-05-01
     * @acceptanceCriteria AC-1 valid → 201; AC-3 server error → user-facing toast
     */
    createOrderDocument: build.mutation<OrderDocumentResponse, OrderDocumentRequest>({
      query: (body) => ({ url: '/order-documents', method: 'POST', body }),
      invalidatesTags: ['OrderDocument'],
    }),
  }),
});

export const { useCreateOrderDocumentMutation } = orderDocumentApi;
```

**Rules:**
- All endpoints share **one** `baseApi` (one `createApi` in the project).
- Use `injectEndpoints` per feature; never call `createApi` again.
- Tag types are declared once on `baseApi` and reused — no string literals in `providesTags`/`invalidatesTags`.
- Auth / refresh-token logic lives in `baseQuery`, not in feature files.

---

## 8. Redux Slice Documentation (`store/slices/*.ts`)

```ts
/**
 * UI slice for the dashboard shell.
 *
 * @description
 * Holds non-server state: sidebar collapsed/open, active sub-module, modal stack.
 *
 * @frd                FRD-2.1
 * @epic               EPIC-DASH-01 — Application Shell
 * @userStory          US-DASH-01-04 — Sidebar collapse persists per session
 * @subTask            ST-DASH-01-04-02
 * @acceptanceCriteria AC-1 collapse state persists across navigation; AC-2 reset on logout
 *
 * @frdContext
 * The dashboard shell exposes a collapsible sidebar. Per AC, the state
 * must persist while the user is logged in but reset on logout.
 *
 * @since 2026-04-27
 */
export const uiSlice = createSlice({ /* … */ });
```

---

## 9. Page Documentation (`app/**/page.tsx`)

A `page.tsx` MUST be thin: it composes components and consumes RTK Query hooks. Its file header is doubly important because it is the only place the route URL is documented.

```tsx
/**
 * @file        app/Dashboard/newconversation/page.tsx
 * @route       /Dashboard/newconversation
 * @module      DashboardModule / NewConversationSubModule
 * @layer       routing
 *
 * @description
 * Route page for the "New Conversation" sub-module. Renders the Research
 * and OrderDocument components side-by-side. No business logic lives here.
 *
 * @frd                FRD-3.2 — New conversation flow
 * @epic               EPIC-DASH-07
 * @userStory          US-DASH-07-01, US-DASH-07-05
 * @subTask            ST-DASH-07-01-01, ST-DASH-07-05-01
 * @acceptanceCriteria AC-1 page renders for authenticated users; AC-2 redirects to /Auth/login otherwise
 *
 * @frdContext
 * The New Conversation page is the user's primary entry point for placing
 * a research/order request. Per FRD-3.2 it must be gated by an authenticated
 * session; unauthenticated users are redirected to /Auth/login by middleware.
 *
 * @since 2026-04-27
 */
```

---

## 10. Context Documentation (`context/*.tsx`)

```tsx
/**
 * Provides the authenticated user, role, and session helpers app-wide.
 *
 * @description
 * Wraps the App Router root. Other components consume the context via
 * `useAuth()`. Server data MUST NOT live here — only auth + session-derived flags.
 *
 * @frd                FRD-1.4 (auth) + FRD-2.7 (role-based UI)
 * @epic               EPIC-AUTH-01
 * @userStory          US-AUTH-01-02, US-AUTH-01-03
 * @subTask            ST-AUTH-01-02-01
 * @acceptanceCriteria AC-1 admin sees admin nav; AC-2 professional view sees pro nav
 *
 * @frdContext
 * Per FRD-2.7, role determines which nav items are visible. Roles supported
 * for v1 are: admin, professional, basic. The role is sourced from the
 * /me endpoint after login and cached in this context until logout.
 *
 * @since 2026-04-27
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
```

---

## 11. DTO / Type Documentation (`types/*.types.ts`)

Types and DTOs are the **wire contract** with the backend. Document every field inline.

```ts
/**
 * Request body for `POST /order-documents`.
 *
 * @frd                FRD-3.2.4
 * @userStory          US-DASH-07-05
 * @subTask            ST-DASH-07-05-01
 * @acceptanceCriteria AC-1 — required fields validated client + server side
 *
 * @frdContext
 * Per FRD-3.2.4, this body must include the conversationId, document type
 * (enum), jurisdiction (ISO-3166-1 alpha-2), and free-text instructions
 * (max 4000 chars). Backend rejects unknown enum values.
 *
 * @since 2026-04-27
 */
export interface OrderDocumentRequest {
  /** UUID v4 of the parent conversation. */
  conversationId: string;
  /** Document type. Allowed: 'research' | 'opinion' | 'memo'. */
  type: OrderDocumentType;
  /** ISO-3166-1 alpha-2 country code. */
  jurisdiction: string;
  /** Free-text instructions, max 4000 chars. */
  instructions: string;
}
```

---

## 12. Naming Conventions

| Construct | Convention | Example |
|-----------|------------|---------|
| Route folder (top module) | PascalCase | `Dashboard`, `Auth` |
| Route folder (sub-module) | lowercase / kebab-case | `newconversation`, `terms-and-policies` |
| Page file | always `page.tsx` | `page.tsx` |
| Component file | PascalCase, `.tsx` | `OrderDocument.tsx` |
| Hook file | `useXxx.ts`, camelCase | `useDebounce.ts` |
| Context file | `XxxContext.tsx` | `AuthContext.tsx` |
| RTK Query slice | `<slug>api.ts` | `orderdocumentapi.ts` |
| Redux slice | `<feature>Slice.ts` | `uiSlice.ts` |
| Type file | lowercase, `.types.ts` | `api.types.ts` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_BYTES` |
| Interface | `PascalCase` (no `I` prefix) | `OrderDocumentRequest` |
| Boolean prop | `isXxx` / `hasXxx` / `canXxx` | `isLoading`, `hasActivePlan` |
| Event handler prop | `onXxx` | `onSubmitted` |

---

## 13. State Management Rules

1. **Server data → RTK Query** (never `useState` for data fetched from the backend).
2. **Client UI state → Redux slice** (`store/slices/`) when shared across distant components, otherwise local `useState`.
3. **Auth + theme + locale → React Context** (`context/`).
4. **Form state → react-hook-form** (or equivalent) — not raw `useState` arrays of fields.
5. **No prop drilling deeper than 2 levels** — promote to Context, slice, or RTK Query selector.

---

## 14. Error Handling

- All RTK Query errors are surfaced through the `error` field of the generated hook. Components MUST render a recoverable UI (toast / inline banner) for every mutation.
- Wrap top-level routes in an **error boundary** (`error.tsx` next to `page.tsx` per Next.js App Router) and document its RTM block per Section 9.
- **Never `console.log` in committed code.** Use a structured logger wrapper (`lib/logger.ts`) and tag logs with `frd`/`userStory` IDs when in catch blocks.

```ts
} catch (err) {
  logger.error('orderdocument.create failed', {
    rtm: { frd: 'FRD-3.2.4', userStory: 'US-DASH-07-05' },
    err,
  });
  throw err;
}
```

---

## 15. Accessibility (a11y)

Every interactive component MUST satisfy:

- All form fields have associated `<label>` (or `aria-label`).
- Buttons that show only an icon include `aria-label`.
- Modals trap focus and restore focus on close.
- Colour contrast ≥ WCAG AA (4.5:1 body, 3:1 large text).
- Keyboard: Tab order is logical; Esc closes overlays; Enter submits forms.
- Each interactive component carries an `@a11y` block listing the above.

---

## 16. Performance

- Memoise list items rendered ≥ 50 at a time.
- Use `next/image` for images; never raw `<img>` for in-app assets.
- Use `next/dynamic` to code-split routes whose first paint is non-critical.
- Avoid creating new object/array literals in JSX (`style={{...}}`); hoist them.
- Wrap heavy components in `React.memo` and document with `@perf`.

---

## 17. Security

- Never render unsanitised HTML. If `dangerouslySetInnerHTML` is required, sanitise with DOMPurify and add an `@security` note.
- Never store secrets / tokens in `localStorage`. Use httpOnly cookies set by the backend.
- Every component that displays PII MUST carry an `@security` note describing what is rendered, why, and which role(s) may see it.
- All outbound URLs go through `services/baseapi.ts` so auth headers are injected centrally; no inline URLs.

---

## 18. Imports & Module Boundaries

```ts
// 1. React / framework
import { FC, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party
import { z } from 'zod';

// 3. Internal — absolute paths via tsconfig "paths" only
import { useCreateOrderDocumentMutation } from '@/features/orderdocument/orderdocumentapi';
import { useAuth } from '@/Hooks/useAuth';
import type { OrderDocumentRequest } from '@/types/api.types';

// 4. Same-folder relative imports
import { OrderDocumentSchema } from './schema';
import styles from './OrderDocument.module.css';
```

**Rules:**
- Absolute imports only for cross-folder references (`@/features/...`).
- A `feature` folder MUST NOT import from another `feature` folder. Lift the shared piece to `lib/` or `Hooks/`.
- A `component` MUST NOT import from `app/`.
- `types/` MUST NOT import runtime code.

---

## 19. Tooling

| Tool | Purpose | Config |
|------|---------|--------|
| `eslint` + `@typescript-eslint` | Linting | `.eslintrc.cjs` |
| `eslint-plugin-jsdoc` | Enforce TSDoc + RTM tags | shared rule set |
| `prettier` | Formatting | `.prettierrc` |
| `typescript --strict` | Type safety | `tsconfig.json` (`"strict": true`) |
| `vitest` / `jest` + RTL | Unit + component tests | per project |
| `playwright` / `cypress` | E2E | per project |
| `husky` + `lint-staged` | Pre-commit gates | `.husky/` |
| `typedoc` | API site generation | `typedoc.json` |

A custom ESLint rule (`local/require-rtm-tags`) MUST fail CI when an exported component, class, hook, or endpoint is missing any of: `@frd`, `@epic`, `@userStory`, `@subTask`, `@frdContext`. `TBD` is an accepted value.

---

## 20. Code Generation Rules for AI

When generating frontend code, the AI MUST:

1. Emit a file header per Section 3, including all RTM tags. Use `TBD` when unknown.
2. Include `@frdContext` prose summarising the FRD/EPIC/User Story narrative — NEVER leave it empty when the source material was supplied.
3. Apply Section 5 to every React component, Section 6 to every hook, Section 7 to every RTK Query endpoint, Section 8 to every Redux slice, Section 9 to every page, Section 10 to every Context, Section 11 to every shared type.
4. Respect length limits (Section 1). Split files / extract hooks before exceeding them.
5. Follow Section 12 naming conventions exactly — pages are always `page.tsx`, RTK files are `<slug>api.ts`.
6. Use the folder layout from *Frontend-FolderStructure-Template.md* — never invent new top-level folders.
7. Insert `// TODO(rtm)` comments wherever a tag was filled with `TBD` so the gap can be greppable.
8. Never produce code without RTM tags, even for "trivial" utilities. Utilities still need `@frd TBD`.

---

## 21. Quick-Reference Checklist (use before opening a PR)

- [ ] File header present and complete (Section 3)
- [ ] All RTM tags present (`@frd`, `@epic`, `@userStory`, `@subTask`) — `TBD` only if truly unknown
- [ ] `@frdContext` paragraph present and useful for an intern
- [ ] Every public component, hook, endpoint, slice has its own RTM block
- [ ] No file > 400 lines, no component > 250, no method > 30
- [ ] Props/types fully documented with inline `/** */`
- [ ] `@a11y`, `@perf`, `@security` notes present where applicable
- [ ] No `fetch`/`axios` calls outside `services/baseapi.ts`
- [ ] No `console.log` in committed code
- [ ] ESLint, Prettier, type-check all green
