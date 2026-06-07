'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { HLD_SECTIONS, type ComponentViewModel } from '@/lib/pipeline-api';

/**
 * Detailed Component View (§5) — engineering-grade layered view: the technical
 * layers, but every component box carries its descriptive subtext (tech ·
 * pattern · semantics) and each layer shows its pattern banner. Followed by the
 * §5.1 "Reading the detailed view" conventions and the §5.2 "How modules show up"
 * table (Service | Dominant concern | Where it lives — with section links).
 * Out-of-scope layers are dropped. HTML/CSS so it exports cleanly to PDF/DOCX.
 */

type Tone = { fill: string; border: string; title: string };
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

// section key → { n, name } for the §5.2 "where it lives" links.
const SECTION_REF: Record<string, { n: number; name: string }> = Object.fromEntries(
  HLD_SECTIONS.map((s, i) => [s.key, { n: i + 1, name: s.name }]),
);

function Connector() {
  return <div className="mx-auto my-1 h-4 w-px border-l border-dashed" style={{ borderColor: T.connector }} />;
}

export function HldComponentViewDiagram({
  model,
  onRegenerate,
  regenerating,
  onNavigateSection,
}: {
  model: ComponentViewModel;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onNavigateSection?: (sectionKey: string) => void;
}) {
  const layers = model.layers ?? [];
  const shown = layers.filter((l) => l.applicable !== false);
  const services = model.services ?? [];

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: T.bandTitle }}>Detailed Component View</span>
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
        {model.intro && <p className="text-[12px] leading-snug" style={{ color: T.caption }}>{model.intro}</p>}

        {/* Enriched layer bands — each component with its descriptive subtext */}
        {shown.length === 0 ? (
          <p className="text-xs text-gray-400">No component layers identified.</p>
        ) : (
          shown.map((l, i) => {
            const tone = TONES[l.key] ?? FALLBACK_TONE;
            return (
              <div key={l.key || i}>
                <div className="rounded-lg border p-3" style={{ background: tone.fill, borderColor: tone.border }}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-[13px] font-semibold" style={{ color: tone.title }}>{l.name}</p>
                    {l.pattern && l.pattern !== '—' && (
                      <span className="text-[10px] italic ml-auto" style={{ color: tone.title }}>{l.pattern}</span>
                    )}
                  </div>
                  {(l.components ?? []).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {l.components!.map((c, ci) => (
                        <div
                          key={ci}
                          className="rounded-md border bg-white/70 px-2.5 py-1.5"
                          style={{ borderColor: tone.border }}
                        >
                          <div className="text-[12px] font-medium leading-tight" style={{ color: tone.title }}>{c.name}</div>
                          {c.subtext && <div className="text-[10px] leading-tight mt-0.5" style={{ color: tone.title, opacity: 0.85 }}>{c.subtext}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px]" style={{ color: tone.title }}>{l.pattern || '—'}</p>
                  )}
                </div>
                {i < shown.length - 1 && <Connector />}
              </div>
            );
          })
        )}

        {/* §5.1 — Reading the detailed view */}
        {(model.reading ?? []).length > 0 && (
          <div className="pt-3 mt-1 border-t">
            <p className="text-[13px] font-semibold mb-1.5" style={{ color: T.bandTitle }}>5.1 · Reading the detailed view</p>
            <ul className="space-y-1 list-disc pl-4">
              {model.reading!.map((r, i) => (
                <li key={i} className="text-[12px] leading-snug" style={{ color: T.caption }}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* §5.2 — How modules show up (Service | Dominant concern | Where it lives) */}
        {services.length > 0 && (
          <div className="pt-3 mt-1 border-t">
            <p className="text-[13px] font-semibold mb-2" style={{ color: T.bandTitle }}>5.2 · How modules show up in this view</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: '#7C4A1E' }}>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={{ borderColor: '#E5E2DD', width: '22%' }}>Service</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={{ borderColor: '#E5E2DD' }}>Dominant concern</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={{ borderColor: '#E5E2DD', width: '26%' }}>Where it lives</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, i) => (
                    <tr key={i} className="align-top">
                      <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{s.name}</td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>
                        {s.dominantConcern?.trim() || '—'}
                      </td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: T.caption }}>
                        {(s.whereKeys ?? []).filter((k) => SECTION_REF[k]).length === 0 ? (
                          '—'
                        ) : (
                          (s.whereKeys ?? [])
                            .filter((k) => SECTION_REF[k])
                            .map((k, ri) => {
                              const ref = SECTION_REF[k];
                              return (
                                <span key={k}>
                                  {ri > 0 && ' · '}
                                  {onNavigateSection ? (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateSection(k)}
                                      className="text-indigo-600 hover:underline"
                                    >
                                      §{ref.n} {ref.name}
                                    </button>
                                  ) : (
                                    <span>§{ref.n} {ref.name}</span>
                                  )}
                                </span>
                              );
                            })
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
