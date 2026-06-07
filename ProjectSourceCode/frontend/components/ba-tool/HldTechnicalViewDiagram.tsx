'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { TechnicalViewModel } from '@/lib/pipeline-api';

/**
 * Layered Technical View (§4) — deterministic layered-band diagram mirroring the
 * reference HLD's §4: vertical bands, one per technical layer, each showing its
 * components as boxes; followed by the §4.1 table (Layer | What lives here | Key
 * technology / pattern). Layers marked not-applicable are dropped from the
 * diagram and shown as "Out of scope" rows in the table. Renders as HTML/CSS so
 * it exports cleanly to PDF and DOCX.
 */

type Tone = { fill: string; border: string; title: string };

// Per-layer pastel tones (keyed by the model's layer keys; falls back by index).
const TONES: Record<string, Tone> = {
  usersRoles: { fill: '#FBECEC', border: '#D98C8C', title: '#9B3B3B' },
  presentation: { fill: '#E9F1FB', border: '#9DBCE6', title: '#2F5FA6' },
  edgeGateway: { fill: '#EFECFB', border: '#B3A6E6', title: '#5A47B5' },
  authz: { fill: '#E6F4EE', border: '#9AD3BC', title: '#2F8A60' },
  appServices: { fill: '#ECEBFB', border: '#B9B0EC', title: '#4F46B5' },
  aiml: { fill: '#FBEEDC', border: '#EAC893', title: '#B97A2B' },
  eventBus: { fill: '#E3F5EC', border: '#A6DCC4', title: '#1E8A5A' },
  dataLayer: { fill: '#FBE7E4', border: '#ECB2AB', title: '#B24A3C' },
  platformDevops: { fill: '#F1F0EC', border: '#D2CFC8', title: '#5C574F' },
};
const FALLBACK_TONE: Tone = { fill: '#F4F3FB', border: '#C9C3E6', title: '#3A3550' };
const T = { caption: '#3D3D3A', bandTitle: '#141413', connector: '#888780' } as const;

function Connector() {
  return <div className="mx-auto my-1 h-4 w-px border-l border-dashed" style={{ borderColor: T.connector }} />;
}

export function HldTechnicalViewDiagram({
  model,
  onRegenerate,
  regenerating,
}: {
  model: TechnicalViewModel;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const layers = model.layers ?? [];
  const shown = layers.filter((l) => l.applicable !== false);

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold" style={{ color: T.bandTitle }}>Layered Technical View</span>
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

        {/* Layered bands — top-down, one per applicable technical layer */}
        {shown.length === 0 ? (
          <p className="text-xs text-gray-400">No technical layers identified.</p>
        ) : (
          shown.map((l, i) => {
            const tone = TONES[l.key] ?? FALLBACK_TONE;
            return (
              <div key={l.key || i}>
                <div className="rounded-lg border p-3" style={{ background: tone.fill, borderColor: tone.border }}>
                  <p className="text-[13px] font-semibold mb-2" style={{ color: tone.title }}>{l.name}</p>
                  {(l.nodes ?? []).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {l.nodes!.map((n, ni) => (
                        <div
                          key={ni}
                          className="rounded-md border bg-white/70 px-2.5 py-2 text-center text-[12px] leading-tight"
                          style={{ borderColor: tone.border, color: tone.title }}
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px]" style={{ color: tone.title }}>{l.keyTech || '—'}</p>
                  )}
                </div>
                {i < shown.length - 1 && <Connector />}
              </div>
            );
          })
        )}

        {/* §4.1 table — Layer | What lives here | Key technology / pattern */}
        <div className="pt-3 mt-2 border-t">
          <p className="text-[13px] font-semibold mb-2" style={{ color: T.bandTitle }}>The technical layers — what lives in each</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr style={{ background: '#7C4A1E' }}>
                  <th className="border px-2.5 py-1.5 font-semibold text-white" style={{ borderColor: '#E5E2DD', width: '20%' }}>Layer</th>
                  <th className="border px-2.5 py-1.5 font-semibold text-white" style={{ borderColor: '#E5E2DD' }}>What lives here</th>
                  <th className="border px-2.5 py-1.5 font-semibold text-white" style={{ borderColor: '#E5E2DD', width: '28%' }}>Key technology / pattern</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((l, i) => {
                  const oos = l.applicable === false;
                  return (
                    <tr key={l.key || i} className="align-top" style={oos ? { background: '#FAFAF9' } : undefined}>
                      <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: oos ? '#9A968F' : T.bandTitle }}>
                        {l.name}
                      </td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: oos ? '#9A968F' : '#3D3D3A' }}>
                        {oos ? (
                          <span className="italic">Out of scope — {l.outOfScope || 'not applicable to this project'}</span>
                        ) : (
                          l.whatLivesHere?.trim() || <span className="text-gray-400 italic">Regenerate to add a description.</span>
                        )}
                      </td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: oos ? '#9A968F' : T.caption }}>
                        {oos ? '—' : l.keyTech?.trim() || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gaps & assumptions */}
        {(model.gaps ?? []).length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
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
