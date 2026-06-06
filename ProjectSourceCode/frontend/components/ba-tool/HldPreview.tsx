'use client';

import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Network } from 'lucide-react';
import { HLD_SECTIONS, HLD_DIAGRAM_LABELS, type Hld } from '@/lib/pipeline-api';
import { HldMermaid } from './HldMermaid';
import type { DiagramPalette } from '@/lib/hld-diagram';

/**
 * HE-03 — canonical read-only HLD preview: all 17 sections rendered in document
 * order + architecture diagrams. Mirrors the PRD's PrdPreview; the on-screen
 * layout matches the PDF/DOCX export (same section order & field rendering).
 */
export function HldPreview({ hld, palette }: { hld: Hld; palette: DiagramPalette }) {
  const diagramKeys = Object.keys(hld.mermaidDiagrams ?? {}).filter((k) => hld.mermaidDiagrams[k]?.trim());
  return (
    <Card>
      <CardContent className="py-6 space-y-6">
        <div className="text-center border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-900">High-Level Design (HLD)</h2>
          <p className="text-xs text-gray-400 mt-1">
            Canonical view · 17 sections · v{hld.version} · {hld.status}
          </p>
        </div>

        {HLD_SECTIONS.map((s, i) => {
          const body = hld.sections?.[s.key] as Record<string, unknown> | undefined;
          return (
            <section key={s.key}>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                <span className="font-mono text-gray-400 mr-2">{i + 1}.</span>
                {s.name}
              </h3>
              {!body || !Object.keys(body).length ? (
                <p className="text-sm text-gray-400 pt-1">Not generated.</p>
              ) : (
                <dl className="pt-1 space-y-3">
                  {Object.entries(body).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {humanize(k)}
                      </dt>
                      <dd className="text-sm text-gray-700 mt-0.5">{renderValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })}

        {diagramKeys.length > 0 && (
          <section className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Network className="h-4 w-4" /> Architecture Diagrams
            </h3>
            {diagramKeys.map((dk) => (
              <div key={dk}>
                <p className="text-xs font-medium text-gray-600 mb-1">{HLD_DIAGRAM_LABELS[dk] ?? dk}</p>
                <HldMermaid content={hld.mermaidDiagrams[dk]} palette={palette} />
              </div>
            ))}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

function AiText({ value }: { value: string }) {
  const isAi = value.startsWith('[AI] ');
  const text = isAi ? value.slice(5) : value;
  return (
    <span>
      {isAi && (
        <span className="text-[9px] uppercase bg-purple-100 text-purple-600 rounded px-1 py-0.5 mr-1 align-middle">
          AI
        </span>
      )}
      <span className="whitespace-pre-wrap">{text}</span>
    </span>
  );
}

function renderValue(value: unknown): ReactNode {
  if (value == null || value === '') return <span className="text-gray-400">—</span>;
  if (typeof value === 'string') return <AiText value={value} />;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((v, i) => (
          <li key={i}>{renderValue(v)}</li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="pl-3 border-l border-gray-100 space-y-1">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-semibold text-gray-400">{humanize(k)}</dt>
          <dd className="text-sm text-gray-700">{renderValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
