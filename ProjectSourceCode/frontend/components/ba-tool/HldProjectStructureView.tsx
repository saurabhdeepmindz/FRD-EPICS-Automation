'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { ProjectStructureModel } from '@/lib/pipeline-api';

/**
 * Project Structure (§17) — monorepo overview. Folders/modules grouped by area
 * (frontend, backend, data, shared, config) rendered as colour-coded tiles, plus
 * AI-agent applicability. Replaces the legacy structure tile diagram. HTML/CSS so
 * it exports cleanly to PDF/DOCX. (§17.1–17.4 detail is layered on separately.)
 */

type Tone = { fill: string; border: string; title: string };
const TONES: Record<string, Tone> = {
  frontend: { fill: '#ECEBFB', border: '#B9B0EC', title: '#4F46B5' },
  backend: { fill: '#E3F5EC', border: '#A6DCC4', title: '#2F8A60' },
  calcEngine: { fill: '#FBEEDC', border: '#EAC893', title: '#B97A2B' },
  db: { fill: '#E8F1FB', border: '#ABCAE9', title: '#2F62A6' },
  shared: { fill: '#FBE7E4', border: '#ECB2AB', title: '#B24A3C' },
  config: { fill: '#F1F0EC', border: '#D2CFC8', title: '#5C574F' },
  ai: { fill: '#FBEAF0', border: '#E2A7C0', title: '#993556' },
};
const FALLBACK_TONE: Tone = { fill: '#F4F3FB', border: '#C9C3E6', title: '#3A3550' };
const T = { caption: '#3D3D3A', bandTitle: '#141413' } as const;

const LEGEND: { kind: string; label: string }[] = [
  { kind: 'frontend', label: 'Frontend' },
  { kind: 'backend', label: 'Backend' },
  { kind: 'calcEngine', label: 'Calc / AI Engine' },
  { kind: 'shared', label: 'Shared Pkgs' },
  { kind: 'db', label: 'DB Tables' },
  { kind: 'config', label: 'Config / Files' },
];

export function HldProjectStructureView({
  model,
  onRegenerate,
  regenerating,
}: {
  model: ProjectStructureModel;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const groups = model.groups ?? [];
  const ai = model.aiAgent;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: T.bandTitle }}>Project Structure</span>
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

        {model.monorepoLabel && (
          <p className="text-center text-[12px] font-medium" style={{ color: T.caption }}>{model.monorepoLabel}</p>
        )}

        {/* Grouped folder/module tiles */}
        {groups.map((g) => {
          const tone = TONES[g.kind] ?? FALLBACK_TONE;
          return (
            <div key={g.key}>
              <p className="text-[12px] font-semibold mb-1.5" style={{ color: tone.title }}>{g.title}</p>
              <div className="flex flex-wrap gap-2">
                {(g.items ?? []).map((it, i) => (
                  <span
                    key={i}
                    className="text-[11px] rounded-md border px-2.5 py-1.5"
                    style={{ background: tone.fill, borderColor: tone.border, color: tone.title }}
                  >
                    {it}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* AI Agent applicability */}
        {ai && (
          <div>
            <p className="text-[12px] font-semibold mb-1.5" style={{ color: ai.applicable === false ? '#9A968F' : TONES.ai.title }}>
              AI Agent
            </p>
            {ai.applicable === false ? (
              <p className="text-[11px] italic" style={{ color: '#9A968F' }}>{ai.note || 'Not applicable — no AI agent required.'}</p>
            ) : (
              <span className="text-[11px] rounded-md border px-2.5 py-1.5" style={{ background: TONES.ai.fill, borderColor: TONES.ai.border, color: TONES.ai.title }}>
                {ai.note || 'apps/ai-agent/'}
              </span>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2 border-t text-[11px]" style={{ color: T.caption }}>
          {LEGEND.map((l) => {
            const tone = TONES[l.kind] ?? FALLBACK_TONE;
            return (
              <span key={l.kind} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border" style={{ background: tone.fill, borderColor: tone.border }} />
                {l.label}
              </span>
            );
          })}
        </div>

        {/* Gaps & assumptions */}
        {(model.gaps ?? []).length > 0 && (
          <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Gaps &amp; assumptions ({model.gaps!.length})
            </p>
            <ul className="space-y-1 list-disc pl-4">
              {model.gaps!.map((g, i) => (
                <li key={i} className="text-[11px] text-amber-700">{g}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
