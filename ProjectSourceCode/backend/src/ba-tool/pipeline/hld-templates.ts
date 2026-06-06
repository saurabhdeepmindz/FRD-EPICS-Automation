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
