'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { SystemViewModel } from '@/lib/pipeline-api';

/**
 * 50,000-ft System View (Sprint v11) — deterministic layered-band diagram that
 * mirrors the reference HRMS architecture: 6 bands (Access/Actors, Core
 * infrastructure, Core functional modules + RBAC, Integration layer, External
 * systems, AI layer) with the reference's exact colour theme. Renders as HTML/CSS
 * so it exports cleanly to PDF and DOCX. Gaps are surfaced as chips.
 */

// Exact theme extracted from the reference SVG.
const T = {
  access: { fill: '#E6F1FB', border: '#185FA5', title: '#0C447C', sub: '#185FA5' },
  infra: { fill: '#EEEDFE', border: '#534AB7', title: '#3C3489', sub: '#534AB7' },
  func: { fill: '#E1F5EE', border: '#0F6E56', title: '#085041', sub: '#0F6E56' },
  integ: { fill: '#FAEEDA', border: '#854F0B', title: '#633806', sub: '#854F0B' },
  ext: { fill: '#FAECE7', border: '#993C1D', title: '#712B13', sub: '#993C1D' },
  ai: { fill: '#FBEAF0', border: '#993556', title: '#72243E', sub: '#993556' },
  caption: '#3D3D3A',
  bandTitle: '#141413',
  connector: '#888780',
} as const;
const BADGE = { 1: '#534AB7', 2: '#BA7517', 3: '#993556' } as const;

type Tone = { fill: string; border: string; title: string; sub: string };

function Box({ tone, title, sub, badge, wide }: { tone: Tone; title: string; sub?: string; badge?: number; wide?: boolean }) {
  return (
    <div
      className={`relative rounded-md border px-2.5 py-2 text-center ${wide ? 'w-full' : ''}`}
      style={{ background: tone.fill, borderColor: tone.border }}
    >
      <div className="text-[13px] font-medium leading-tight" style={{ color: tone.title }}>{title}</div>
      {sub && <div className="text-[11px] leading-tight" style={{ color: tone.sub }}>{sub}</div>}
      {badge ? (
        <span
          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full text-[9px] font-semibold text-white flex items-center justify-center"
          style={{ background: BADGE[badge as 1 | 2 | 3] ?? BADGE[1] }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] mb-1.5" style={{ color: T.caption }}>{children}</p>;
}
function Connector() {
  return <div className="mx-auto my-1 h-4 w-px border-l border-dashed" style={{ borderColor: T.connector }} />;
}

export function HldSystemViewDiagram({
  model,
  onRegenerate,
  regenerating,
}: {
  model: SystemViewModel;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const m = model;
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold" style={{ color: T.bandTitle }}>50,000-ft System View</span>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="ml-auto text-[11px] text-indigo-600 hover:underline disabled:opacity-50"
            >
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>

        {/* 1 — Access layer (channels) + actors */}
        <Caption>Access layer</Caption>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(m.channels ?? []).map((c, i) => (
            <Box key={i} tone={T.access} title={c} />
          ))}
        </div>
        {(m.actors ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <span className="text-[11px]" style={{ color: T.caption }}>Actors:</span>
            {m.actors.map((a, i) => (
              <span key={i} className="text-[11px] rounded-full px-2 py-0.5 border" style={{ background: T.access.fill, borderColor: T.access.border, color: T.access.title }}>
                {a}
              </span>
            ))}
          </div>
        )}

        <Connector />

        {/* 2 — Core infrastructure */}
        <Caption>Core infrastructure</Caption>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(m.coreInfra ?? []).map((c, i) => (
            <Box key={i} tone={T.infra} title={c} />
          ))}
        </div>

        <Connector />

        {/* 3 — Core functional modules + RBAC */}
        <div className="rounded-xl border p-3" style={{ borderColor: T.connector }}>
          <p className="text-[13px] font-medium mb-2" style={{ color: T.bandTitle }}>Core functional modules</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(m.functionalModules ?? []).map((f, i) => (
              <Box
                key={i}
                tone={T.func}
                title={f.name}
                sub={f.subtitle}
                badge={f.thirdParty ? 1 : f.phase && f.phase > 1 ? f.phase : undefined}
              />
            ))}
          </div>
          {m.rbac && (
            <div className="mt-2">
              <Box tone={T.func} title={m.rbac.title} sub={m.rbac.subtitle} wide />
            </div>
          )}
        </div>

        <Connector />

        {/* 4 — Integration layer */}
        <Caption>Integration layer — 3rd party module integrations</Caption>
        {(m.integrationModules ?? []).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {m.integrationModules.map((f, i) => (
              <Box key={i} tone={T.integ} title={f.name} sub={f.subtitle} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No module-level external integrations identified.</p>
        )}

        <Connector />

        {/* 5 — External / 3rd party systems */}
        <div className="rounded-xl border border-dashed p-3" style={{ borderColor: T.connector }}>
          <p className="text-[13px] font-medium" style={{ color: T.bandTitle }}>
            External / 3rd party systems{' '}
            {m.gatewayNote && <span className="text-[11px] font-normal" style={{ color: T.caption }}>— {m.gatewayNote}</span>}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {(m.externalGroups ?? []).map((g, i) => (
              <div key={i} className="rounded-md border px-2.5 py-2" style={{ background: T.ext.fill, borderColor: T.ext.border }}>
                <div className="text-[13px] font-medium" style={{ color: T.ext.title }}>{g.title}</div>
                <div className="text-[11px] leading-snug" style={{ color: T.ext.sub }}>{(g.items ?? []).join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>

        <Connector />

        {/* 6 — AI layer */}
        <div className="rounded-xl border p-3" style={{ borderColor: T.connector }}>
          <p className="text-[13px] font-medium" style={{ color: T.bandTitle }}>
            AI layer <span className="text-[11px] font-normal" style={{ color: T.caption }}>— conversational, RAG, multi-LLM</span>
          </p>
          {hasAi(m) ? (
            <div className="mt-2 space-y-2">
              {(m.aiLayer?.capabilities ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.aiLayer!.capabilities!.map((c, i) => (
                    <span key={i} className="text-[11px] rounded px-2 py-0.5 border" style={{ background: T.ai.fill, borderColor: T.ai.border, color: T.ai.sub }}>
                      {c}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {m.aiLayer?.rag?.title && <Box tone={T.ai} title={m.aiLayer.rag.title} sub={m.aiLayer.rag.subtitle} />}
                {(m.aiLayer?.llmProviders ?? []).length > 0 && (
                  <Box tone={T.ai} title="LLM provider" sub={m.aiLayer!.llmProviders!.join(' · ')} />
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">No AI layer in scope for this project.</p>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-3 mt-1 border-t text-[11px]" style={{ color: T.caption }}>
          <LegendDot n={1} label="3rd party integration" />
          <LegendDot n={2} label="Phase 2" />
          <LegendDot n={3} label="Phase 3 / future" />
        </div>

        {/* Gaps & assumptions */}
        {(m.gaps ?? []).length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Gaps &amp; assumptions ({m.gaps!.length})
            </p>
            <ul className="space-y-1 list-disc pl-4">
              {m.gaps!.map((g, i) => (
                <li key={i} className="text-[11px] text-amber-700">{g}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function hasAi(m: SystemViewModel): boolean {
  const a = m.aiLayer;
  return !!a && ((a.capabilities?.length ?? 0) > 0 || !!a.rag?.title || (a.llmProviders?.length ?? 0) > 0);
}

function LegendDot({ n, label }: { n: 1 | 2 | 3; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-4 w-4 rounded-full text-[9px] font-semibold text-white flex items-center justify-center" style={{ background: BADGE[n] }}>{n}</span>
      {label}
    </span>
  );
}
