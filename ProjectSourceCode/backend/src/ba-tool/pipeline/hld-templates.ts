/**
 * HLD Architecture-template source (Sprint v10 / Track D — the "Architecture
 * console"). A `TemplateSource` abstraction so the Copilot's Templates tab can
 * draw from multiple origins behind ONE shape:
 *   - builtin    : curated starter architecture patterns shipped in code (below);
 *   - library    : existing `BaTemplate` rows (GLOBAL + this project) — reuse now.
 * The deferred curated catalog (HD-02) and "save HLD as template" (HD-09) add
 * more sources implementing this same interface — no UI/contract rework.
 */

export interface HldTemplate {
  id: string;
  name: string;
  summary: string;
  body: string;
  source: 'builtin' | 'library';
}

/** Curated starter patterns — give the console immediate value without a catalog. */
export const BUILTIN_ARCH_TEMPLATES: HldTemplate[] = [
  {
    id: 'builtin:multi-tenant-rls',
    name: 'Multi-tenant SaaS (Row-Level Security)',
    summary: 'Single DB, tenant_id on every table, Postgres RLS policies. Lowest cost, strong isolation.',
    source: 'builtin',
    body: [
      'Pattern: Multi-tenant SaaS with Row-Level Security (RLS).',
      '- Single shared database; every tenant-scoped table carries a tenant_id (or org_id) column.',
      '- Enforce isolation with Postgres RLS CREATE POLICY rules keyed on the session tenant.',
      '- App sets the tenant context per request; API-layer ownership checks as a second line.',
      '- Trade-offs: lowest infra cost, noisy-neighbour risk, careful index design on (tenant_id, …).',
    ].join('\n'),
  },
  {
    id: 'builtin:schema-per-tenant',
    name: 'Schema-per-tenant',
    summary: 'One Postgres schema per tenant. Stronger isolation, moderate ops overhead.',
    source: 'builtin',
    body: [
      'Pattern: Schema-per-tenant.',
      '- One database, one schema per tenant; identical table definitions per schema.',
      '- Connection/search_path set per tenant; migrations fan out across schemas.',
      '- Trade-offs: stronger isolation than RLS, heavier migration + connection management, bounded tenant count.',
    ].join('\n'),
  },
  {
    id: 'builtin:event-driven',
    name: 'Event-driven backbone (queue + outbox)',
    summary: 'Async services communicating via a broker with the transactional outbox pattern.',
    source: 'builtin',
    body: [
      'Pattern: Event-driven backbone.',
      '- Services emit domain events to a broker (Kafka/SQS/Rabbit); consumers react asynchronously.',
      '- Use the transactional outbox + relay to avoid dual-write inconsistencies.',
      '- Idempotent consumers, dead-letter queues, and schema-versioned events.',
      '- Trade-offs: great decoupling/scalability, added operational + eventual-consistency complexity.',
    ].join('\n'),
  },
  {
    id: 'builtin:layered-3tier',
    name: 'Layered 3-tier (presentation / services / data)',
    summary: 'Classic stateless app tier behind a gateway over a relational store. Safe default.',
    source: 'builtin',
    body: [
      'Pattern: Layered 3-tier.',
      '- Presentation (web/mobile) → stateless application services behind an API gateway → data tier.',
      '- Horizontal scale on the app tier; cache (Redis) for hot reads; CDN for static assets.',
      '- Trade-offs: simple and well-understood; can become a distributed monolith if boundaries blur.',
    ].join('\n'),
  },
  {
    id: 'builtin:rag-ai-layer',
    name: 'RAG / AI layer',
    summary: 'Retrieval-augmented generation: embeddings + vector store + LLM orchestration.',
    source: 'builtin',
    body: [
      'Pattern: Retrieval-Augmented Generation (RAG) AI layer.',
      '- Ingest → chunk → embed → vector store (pgvector/Pinecone); retrieve top-k at query time.',
      '- LLM orchestration with grounded prompts, citations, and guardrails; cache frequent queries.',
      '- Separate the AI service from core APIs; budget tokens and add fallbacks.',
      '- Trade-offs: powerful, but adds retrieval quality, cost, and evaluation concerns.',
    ].join('\n'),
  },
  {
    id: 'builtin:cqrs-es',
    name: 'CQRS + Event Sourcing',
    summary: 'Separate write (commands/events) and read (projections) models. Strong auditability.',
    source: 'builtin',
    body: [
      'Pattern: CQRS + Event Sourcing.',
      '- Commands append immutable events; read models are projections rebuilt from the event log.',
      '- Full audit trail and temporal queries; read/write scale independently.',
      '- Trade-offs: high complexity and eventual consistency — reserve for domains that truly need auditability.',
    ].join('\n'),
  },
  {
    id: 'builtin:microservices',
    name: 'Microservices (bounded contexts)',
    summary: 'Independently deployable services per bounded context, each owning its data.',
    source: 'builtin',
    body: [
      'Pattern: Microservices by bounded context.',
      '- One service per business capability; database-per-service (no shared DB).',
      '- Sync via API gateway, async via events; contracts versioned; observability is mandatory.',
      '- Trade-offs: independent scale/deploy vs. distributed-systems complexity (latency, consistency, ops). Avoid prematurely; start modular-monolith.',
    ].join('\n'),
  },
  {
    id: 'builtin:modular-monolith',
    name: 'Modular monolith',
    summary: 'One deployable, strict internal module boundaries. The pragmatic default before microservices.',
    source: 'builtin',
    body: [
      'Pattern: Modular monolith.',
      '- Single deployable; enforce module boundaries (separate packages, explicit interfaces, no cross-module DB access).',
      '- Easy to refactor and later extract a module into a service when a real scaling/ownership need appears.',
      '- Trade-offs: simplest ops + fastest iteration; risk of erosion into a big ball of mud without discipline.',
    ].join('\n'),
  },
  {
    id: 'builtin:api-gateway-bff',
    name: 'API Gateway + BFF',
    summary: 'Edge gateway for cross-cutting concerns + a Backend-for-Frontend per client.',
    source: 'builtin',
    body: [
      'Pattern: API Gateway + Backend-for-Frontend (BFF).',
      '- Gateway handles authn, rate-limiting, routing, TLS; a BFF per client (web/mobile) tailors payloads + aggregation.',
      '- Keeps clients simple and decouples them from internal service shape.',
      '- Trade-offs: extra hop + components to operate; avoid putting business logic in the gateway.',
    ].join('\n'),
  },
  {
    id: 'builtin:serverless',
    name: 'Serverless (FaaS + managed services)',
    summary: 'Functions + managed queues/DB/auth. Scale-to-zero, pay-per-use, minimal ops.',
    source: 'builtin',
    body: [
      'Pattern: Serverless.',
      '- Event-driven functions (Lambda/Cloud Functions) over managed services (queues, DynamoDB/Firestore, auth, storage).',
      '- Great for spiky/low-baseline workloads; minimal infra to run.',
      '- Trade-offs: cold starts, execution/time limits, vendor lock-in, harder local testing + long-running jobs.',
    ].join('\n'),
  },
  {
    id: 'builtin:hexagonal',
    name: 'Hexagonal / Clean architecture',
    summary: 'Domain core isolated behind ports; adapters for DB/UI/external — highly testable.',
    source: 'builtin',
    body: [
      'Pattern: Hexagonal (ports & adapters) / Clean architecture.',
      '- Pure domain core depends on nothing; ports define interfaces; adapters implement DB/HTTP/queue/UI.',
      '- Dependencies point inward; swap infrastructure without touching business rules; excellent unit-testability.',
      '- Trade-offs: more indirection/boilerplate; worth it for complex, long-lived domains.',
    ].join('\n'),
  },
  {
    id: 'builtin:strangler-fig',
    name: 'Strangler Fig (incremental migration)',
    summary: 'Wrap a legacy system and replace it route-by-route behind a façade.',
    source: 'builtin',
    body: [
      'Pattern: Strangler Fig migration.',
      '- Put a façade/proxy in front of the legacy system; redirect one capability at a time to the new implementation.',
      '- Ship continuously, reduce risk, retire the legacy once all routes are migrated.',
      '- Trade-offs: dual-running cost + data-sync during transition; needs a clear seam + routing layer.',
    ].join('\n'),
  },
  {
    id: 'builtin:observability',
    name: 'Observability stack (logs/metrics/traces)',
    summary: 'Structured logs + metrics + distributed tracing with SLOs and alerting.',
    source: 'builtin',
    body: [
      'Pattern: Observability baseline.',
      '- Structured JSON logs, RED/USE metrics (Prometheus/Grafana), distributed tracing (OpenTelemetry), correlation IDs end-to-end.',
      '- Define SLOs + alerts on symptoms (latency/error rate), dashboards per service; sample traces to control cost.',
      '- Trade-offs: instrumentation effort + telemetry storage cost; non-negotiable for production microservices.',
    ].join('\n'),
  },
];

/** Map a BaTemplate-like row into the shared HldTemplate shape. */
export function libraryTemplateToHld(row: { id: string; name: string; content: string }): HldTemplate {
  const content = (row.content ?? '').trim();
  return {
    id: `library:${row.id}`,
    name: row.name,
    summary: content.slice(0, 140) + (content.length > 140 ? '…' : ''),
    body: content,
    source: 'library',
  };
}
