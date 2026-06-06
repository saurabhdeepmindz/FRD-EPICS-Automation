'use client';

import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Network } from 'lucide-react';
import { HLD_SECTIONS, HLD_DIAGRAM_LABELS, type Hld, type ProjectStructure } from '@/lib/pipeline-api';
import { HldMermaid } from './HldMermaid';
import { HldStructureDiagram } from './HldStructureDiagram';
import { Markdown } from './Markdown';
import { DIAGRAM_FOR_SECTION, type DiagramPalette } from '@/lib/hld-diagram';

/**
 * HE-03 — canonical read-only HLD preview (PRD-style). All 17 sections in order,
 * each with an anchor id (`prev-<key>`) so the left menu can jump to it; inline
 * architecture diagram + pastel structure grid where applicable; section text
 * rendered as markdown (incl. the merged `aiSynthesis` field). Any diagram not
 * mapped to a section is shown in a trailing "Architecture Diagrams" block.
 */
export function HldPreview({
  hld,
  palette,
  structure,
}: {
  hld: Hld;
  palette: DiagramPalette;
  structure?: ProjectStructure | null;
}) {
  const allDiagramKeys = Object.keys(hld.mermaidDiagrams ?? {}).filter((k) => hld.mermaidDiagrams[k]?.trim());
  const mappedDiagramKeys = new Set(
    HLD_SECTIONS.map((s) => DIAGRAM_FOR_SECTION[s.key]).filter((dk): dk is string => !!dk && !!hld.mermaidDiagrams?.[dk]?.trim()),
  );
  const unmappedDiagramKeys = allDiagramKeys.filter((k) => !mappedDiagramKeys.has(k));

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
          const diagKey = DIAGRAM_FOR_SECTION[s.key];
          const diagram = diagKey ? hld.mermaidDiagrams?.[diagKey] : undefined;
          return (
            <section key={s.key} id={`prev-${s.key}`} className="scroll-mt-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                <span className="font-mono text-gray-400 mr-2">{i + 1}.</span>
                {s.name}
              </h3>

              {/* Inline architecture diagram for this section (v9 MM parity) */}
              {diagram && (
                <div className="mb-3 border rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5" /> {HLD_DIAGRAM_LABELS[diagKey] ?? 'Diagram'}
                  </p>
                  <HldMermaid content={diagram} palette={palette} />
                </div>
              )}

              {/* Pastel project-structure grid for §17 */}
              {s.key === 'projectStructure' && structure && (
                <div className="mb-3">
                  <HldStructureDiagram structure={structure} palette={palette} />
                </div>
              )}

              {!body || !Object.keys(body).length ? (
                <p className="text-sm text-gray-400 pt-1">Not generated.</p>
              ) : (
                <dl className="pt-1 space-y-3">
                  {Object.entries(body).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{humanize(k)}</dt>
                      <dd className="text-sm text-gray-700 mt-0.5">{renderValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })}

        {/* Diagrams not tied to a specific section */}
        {unmappedDiagramKeys.length > 0 && (
          <section id="prev-__diagrams" className="scroll-mt-6 border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Network className="h-4 w-4" /> Architecture Diagrams
            </h3>
            {unmappedDiagramKeys.map((dk) => (
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

function renderValue(value: unknown): ReactNode {
  if (value == null || value === '') return <span className="text-gray-400">—</span>;
  if (typeof value === 'string') {
    const isAi = value.startsWith('[AI] ');
    const text = isAi ? value.slice(5) : value;
    return (
      <div>
        {isAi && (
          <span className="text-[9px] uppercase bg-purple-100 text-purple-600 rounded px-1 py-0.5 mr-1 align-middle">
            AI
          </span>
        )}
        <Markdown className="inline-block w-full align-top">{text}</Markdown>
      </div>
    );
  }
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
