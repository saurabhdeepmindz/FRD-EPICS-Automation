# Frontend Folder Structure Template

> **Purpose:** This document is the **authoritative folder & file structure** that any AI / code generator MUST follow when scaffolding or extending frontend code (Next.js + React + Redux Toolkit / RTK Query) for any module of this project. It is module-agnostic — every functional area of the app reuses the same shape.
>
> **Stack assumptions** (derived from the source spec):
> - **Framework:** Next.js (App Router → file-based routing under `app/`).
> - **UI:** React + TypeScript.
> - **State:** Redux Toolkit + RTK Query for API integration; React Context for app-wide concerns (auth, preferences/themes/language).
> - **Styling:** CSS (`Global.css`, `Variable.css`) + a `theme.ts` token file.
>
> **How to use:**
> 1. Replace the example sub-modules (`newconversation`, `orderdocument`, `filelibrary`, etc.) with the sub-modules that actually exist for the feature you are generating.
> 2. Always mirror a backend module on the frontend in **three places**: a route (`app/<TopModule>/<sub-module>/page.tsx`), its components (`components/<sub-module>/...`), and its API client (`features/<sub-module>/<sub-module>api.ts`).
> 3. Cross-cutting concerns (auth context, theme, hooks, store, types) live in their dedicated top-level folders — never inside a route folder.

---

## 1. Top-Level Layout

```
<frontend-root>/                   # (Next.js src root)
├── app/                           # Next.js App Router — every page lives here
│   ├── Dashboard/                 # Top-most functional module (mirrors backend modules)
│   │   ├── newconversation/       # Sub-module
│   │   │   └── page.tsx
│   │   ├── verifiedconversation/
│   │   │   └── page.tsx
│   │   ├── allconversation/
│   │   │   └── page.tsx
│   │   ├── purchasedocument/
│   │   │   └── page.tsx
│   │   ├── library/
│   │   │   └── page.tsx
│   │   ├── plans/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   └── terms-and-policies/
│   │       └── page.tsx
│   └── Auth/                      # Top-most auth area
│       ├── page.tsx
│       ├── login/
│       │   └── page.tsx
│       └── signup/
│           └── page.tsx
├── components/                    # Reusable UI components
│   ├── common/                    # App-wide generic components
│   ├── ui/                        # Design-system primitives (Button, Input, …)
│   ├── shared/                    # Components shared across modules
│   └── <sub-module>/              # Components scoped to a sub-module
│       └── <Component>.tsx        # e.g., OrderDocument.tsx, Research.tsx
├── context/                       # React Contexts for global, non-Redux state
│   ├── AuthContext.tsx
│   └── AppPreferenceContextType.tsx
├── features/                      # RTK Query slices — one folder per backend module
│   ├── auth/
│   │   └── authapi.ts
│   ├── filelibrary/
│   │   └── filelibraryapi.ts
│   └── orderdocument/
│       └── orderdocumentapi.ts
├── Hooks/                         # Custom React hooks reused across components
│   ├── useAuth.ts
│   ├── useFetch.ts
│   └── useDebounce.ts
├── public/                        # Static assets (served as-is)
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   └── favicon.ico
├── services/                      # RTK Query base setup
│   └── baseapi.ts
├── store/                         # Redux store wiring
│   ├── index.ts
│   ├── slices/
│   └── rootReducer.ts
├── styles/                        # Global CSS + theme tokens
│   ├── Global.css
│   ├── Variable.css
│   └── theme.ts
└── types/                         # Shared TypeScript types
    ├── index.ts
    ├── api.types.ts
    └── user.types.ts
```

---

## 2. `app/` — Routing & Pages (Next.js App Router)

The `app/` folder is the **routing root**. Every URL maps directly to a folder containing a `page.tsx`. Folder names become URL segments.

> **Naming rule:** Top-most modules in this template are PascalCase (`Dashboard`, `Auth`) to match the source spec. All sub-modules are lowercase, hyphen-separated when multi-word (`terms-and-policies`).

### 2.1 `app/Dashboard/` — top-most application module

`Dashboard` is the topmost frontend module and the primary container for the application's functional sub-modules. **Every backend functional module typically maps to one sub-folder here.**

| Path | Purpose |
|------|---------|
| `app/Dashboard/` | Topmost module folder. Contains the dashboard's own layout and all its sub-modules. |
| `app/Dashboard/newconversation/page.tsx` | Sub-module page. UI is composed from `components/newconversation/*` (e.g., `Research`, `OrderDocument`). |
| `app/Dashboard/verifiedconversation/page.tsx` | Sub-module page; components live in `components/verifiedconversation/`. |
| `app/Dashboard/allconversation/page.tsx` | Sub-module page; components live in `components/allconversation/`. |
| `app/Dashboard/purchasedocument/page.tsx` | Sub-module page; components live in `components/purchasedocument/`. |
| `app/Dashboard/library/page.tsx` | Sub-module page; components live in `components/library/`. |
| `app/Dashboard/plans/page.tsx` | Sub-module page; components live in `components/plans/`. |
| `app/Dashboard/profile/page.tsx` | Sub-module page; components live in `components/profile/`. |
| `app/Dashboard/terms-and-policies/page.tsx` | Sub-module page; components live in `components/terms-and-policies/`. |

> **Rule:** A sub-module added under `app/Dashboard/` MUST also have:
> - a matching folder under `components/<sub-module>/` for its UI parts, AND
> - (if it talks to the backend) a matching folder under `features/<sub-module>/` with `<sub-module>api.ts` for RTK Query.

### 2.2 `app/Auth/` — top-most auth area

| Path | Purpose |
|------|---------|
| `app/Auth/` | Top-most folder for the frontend authentication area. |
| `app/Auth/page.tsx` | Auth landing page. |
| `app/Auth/login/page.tsx` | Login route. |
| `app/Auth/signup/page.tsx` | Signup route. |

> **Rule:** Auth-related API calls MUST go through `features/auth/authapi.ts`, never inline in the page.

---

## 3. `components/` — Reusable UI

Anything renderable that is reused, or that is non-trivial enough to deserve its own file, lives here. Pages should be **thin** — they assemble components and wire data.

| Path | Purpose |
|------|---------|
| `components/common/` | App-wide generic components (Loader, ErrorBoundary, EmptyState, etc.). |
| `components/ui/` | Design-system primitives (Button, Input, Modal, Card). No business logic. |
| `components/shared/` | Components used by multiple sub-modules but not generic enough for `ui/`. |
| `components/<sub-module>/` | Components scoped to a specific sub-module, mirroring the route folder name. |
| `components/newconversation/OrderDocument.tsx` | Example: a component for the `newconversation` sub-module. |
| `components/newconversation/Research.tsx` | Example: another component for the `newconversation` sub-module. |

> **Rule:** A component file must contain **one** default-exported component. Co-locate small helpers; promote shared helpers to `Hooks/` or a util module.

---

## 4. `context/` — React Context state

For state that must be available app-wide but does not belong in Redux (typically because it's UI-level or auth-level).

| File | Purpose |
|------|---------|
| `context/AuthContext.tsx` | Provides the user role (e.g., admin, professional view) to the component tree. |
| `context/AppPreferenceContextType.tsx` | Provides theme, language, and other app preferences. |

> **Rule:** API state, server cache, and entity data belong in **RTK Query / Redux**, not Context. Use Context only for cross-cutting, mostly-static UI/auth state.

---

## 5. `features/` — RTK Query API slices (one folder per backend module)

This is the **bridge between the frontend and the backend**. Each backend module exposes a controller; each backend controller maps to one folder here, and one `*.api.ts` file inside it that defines the RTK Query endpoints.

| Path | Purpose |
|------|---------|
| `features/auth/authapi.ts` | RTK Query endpoints for the backend `auth` controller. |
| `features/filelibrary/filelibraryapi.ts` | RTK Query endpoints for the backend `filelibrary` controller. |
| `features/orderdocument/orderdocumentapi.ts` | RTK Query endpoints for the backend `newconversation` module's order-document component. |
| `features/profile/profileapi.ts` | (add when needed) RTK Query endpoints for profile. |
| `features/dashboard/dashboardapi.ts` | (add when needed) RTK Query endpoints for dashboard. |

> **Naming:** filename pattern is `<slug>api.ts` (lowercase, no separator). The slug must match the backend module/controller slug so the mapping is mechanical.

> **Rule:** All HTTP calls go through an RTK Query endpoint defined here. Components MUST call generated hooks (`useGetXQuery`, `useCreateYMutation`) — they MUST NOT call `fetch` / `axios` directly.

---

## 6. `Hooks/` — Custom React hooks

Reusable hooks for cross-component logic.

| File | Purpose |
|------|---------|
| `Hooks/useAuth.ts` | Common auth-related logic used by components under the auth area. |
| `Hooks/useFetch.ts` | Generic fetch helper for non-RTK use cases (rare — prefer RTK Query). |
| `Hooks/useDebounce.ts` | Debounce primitive for inputs/searches. |

> **Rule:** Anything that starts with `use*` and is reused by ≥2 components belongs here.

---

## 7. `public/` — Static assets

Served as-is by Next.js at the root URL.

| Path | Purpose |
|------|---------|
| `public/images/` | Application images (PNG/JPG/SVG/WebP). |
| `public/icons/` | Icon assets. |
| `public/fonts/` | Self-hosted fonts. |
| `public/favicon.ico` | Browser tab icon. |

---

## 8. `services/` — RTK Query base setup

Holds the shared base API instance that every `features/*/*api.ts` extends.

| File | Purpose |
|------|---------|
| `services/baseapi.ts` | `createApi` base — defines `baseQuery` (with auth header injection), tag types, and is extended via `injectEndpoints` in each feature's API file. |

> **Rule:** There is exactly ONE `baseapi.ts`. Feature API files **inject** endpoints into it; they do not create separate `createApi` instances.

---

## 9. `store/` — Redux store

| File | Purpose |
|------|---------|
| `store/index.ts` | Configures the store via `configureStore` and exports the `Provider`-ready store, plus `RootState` and `AppDispatch` types. |
| `store/rootReducer.ts` | Combines all reducers (RTK Query reducer + feature slices). |
| `store/slices/` | Folder of `createSlice` files (one per piece of client-side state). |

> **Rule:** The store is **global** — only mount the `<Provider>` once at the App Router root. Server cache lives in RTK Query, client UI state lives in `slices/`.

---

## 10. `styles/` — CSS & theme tokens

| File | Purpose |
|------|---------|
| `styles/Global.css` | Global resets and base styles imported once at the app root. |
| `styles/Variable.css` | CSS custom properties (design tokens — colors, spacing, radii). |
| `styles/theme.ts` | Typed theme object consumed by JS/TS code (mirrors `Variable.css`). |

---

## 11. `types/` — Shared TypeScript types

| File | Purpose |
|------|---------|
| `types/index.ts` | Barrel re-export of all shared types. |
| `types/api.types.ts` | Request/response DTO types shared across features (often mirroring backend `dto/`). |
| `types/user.types.ts` | User/role/permission types. |

> **Rule:** Module-internal types stay co-located with the component/feature. Only **truly shared** types come here.

---

## 12. Naming Conventions (MUST FOLLOW)

| Element | Convention | Example |
|---------|------------|---------|
| Top-most route folder | PascalCase | `Dashboard`, `Auth` |
| Sub-module route folder | lowercase (kebab-case for multi-word) | `newconversation`, `terms-and-policies` |
| Page file | always `page.tsx` (Next.js requirement) | `page.tsx` |
| Component file | PascalCase, `.tsx` | `OrderDocument.tsx`, `Research.tsx` |
| Hook file | camelCase, starts with `use`, `.ts` | `useAuth.ts`, `useDebounce.ts` |
| Context file | PascalCase, ends with `Context.tsx` or `ContextType.tsx` | `AuthContext.tsx`, `AppPreferenceContextType.tsx` |
| RTK Query feature folder | lowercase, matches backend slug | `auth`, `orderdocument`, `filelibrary` |
| RTK Query API file | `<slug>api.ts` | `authapi.ts`, `orderdocumentapi.ts` |
| Slice file (under `store/slices/`) | `<feature>Slice.ts` | `authSlice.ts`, `uiSlice.ts` |
| CSS file | PascalCase or kebab-case, `.css` | `Global.css`, `Variable.css` |
| Type file | lowercase, `.types.ts` suffix | `api.types.ts`, `user.types.ts` |

---

## 13. Frontend ↔ Backend Mirroring Rule

Every backend module (under `apps/<module>/` per the backend template) typically produces **all four** of these on the frontend:

| Backend artifact | Frontend mirror |
|------------------|-----------------|
| `apps/<module>/src/controller/<module>.controller.ts` | `features/<module>/<module>api.ts` (RTK Query endpoints) |
| `apps/<module>/src/dto/*.dto.ts` | Types in `types/api.types.ts` (or co-located in the feature) |
| Routes/use-cases of the module | One sub-folder under `app/Dashboard/<sub-module>/page.tsx` |
| The UI parts of the module | One sub-folder under `components/<sub-module>/` |

When generating frontend code for a new backend module, the AI MUST create all four (or explicitly justify why one is omitted).

---

## 14. Code Generation Rules for AI

When generating frontend code for any new or existing module, the AI MUST:

1. **Place files exactly per Sections 2–11** — no flat dumps, no merging of `features/`, `components/`, and `app/`.
2. **Pages stay thin:** a `page.tsx` should compose components from `components/<sub-module>/` and call hooks from `features/<sub-module>/<sub-module>api.ts`. Pages MUST NOT contain `fetch`/`axios` calls or large inline JSX trees.
3. **One RTK Query base:** all feature APIs are `injectEndpoints` extensions of the single `services/baseapi.ts`.
4. **Mirror the backend:** when adding a sub-module under `app/Dashboard/<sub>/`, also create `components/<sub>/` and (if it makes API calls) `features/<sub>/<sub>api.ts`.
5. **Auth & preferences via Context, server data via RTK Query.** Do not put server data in Context, do not put theme/locale in Redux.
6. **Custom hooks live in `Hooks/`** — not duplicated across components.
7. **Static assets always under `public/`** — never imported from `app/` or `components/`.
8. **Shared types only in `types/`** — module-internal types stay co-located.
9. **Filename casing per Section 12** — components PascalCase, hooks `useXxx.ts`, RTK Query files `<slug>api.ts`, page files always `page.tsx`.
10. **No empty folders.** Create a folder only when at least one file is generated for it.

---

## 15. Quick Reference (canonical tree for one sub-module)

For a hypothetical sub-module `orderdocument` (UI lives in Dashboard, talks to backend `orderdocument` controller):

```
app/Dashboard/orderdocument/
└── page.tsx                     # composes components, calls RTK Query hooks

components/orderdocument/
├── OrderDocumentForm.tsx
└── OrderDocumentList.tsx

features/orderdocument/
└── orderdocumentapi.ts          # injectEndpoints into services/baseapi.ts

types/api.types.ts               # add OrderDocument request/response types here (if shared)
```

This is the canonical shape. Every new sub-module replicates it.

---

## 16. Example: Wiring `newconversation` end-to-end

The source table calls out `newconversation` as a flagship example. Here is exactly what the AI should generate for it:

```
app/Dashboard/newconversation/page.tsx          # imports <Research/>, <OrderDocument/>
components/newconversation/Research.tsx         # research UI component
components/newconversation/OrderDocument.tsx    # order-document UI component
features/orderdocument/orderdocumentapi.ts      # RTK Query endpoints for backend order-document controller
```

`page.tsx` consumes the generated RTK Query hooks (e.g., `useCreateOrderDocumentMutation`) from `features/orderdocument/orderdocumentapi.ts` and renders the components from `components/newconversation/`.
