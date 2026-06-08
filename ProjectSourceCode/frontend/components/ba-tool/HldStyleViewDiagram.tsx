'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { StyleViewModel } from '@/lib/pipeline-api';

/**
 * Architecture Style & Design Patterns View (§6) — the system reframed "by
 * architectural choice": an Actors row feeding the architectural tiers (each with
 * its pattern caption + components), followed by §6.1 (architectural choices),
 * §6.2 (patterns by tier) and §6.3 (the 3-Tier Module Pattern). HTML/CSS so it
 * exports cleanly to PDF/DOCX.
 */

type Tone = { fill: string; border: string; title: string };
const TONES: Record<string, Tone> = {
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
const T = { caption: '#3D3D3A', bandTitle: '#141413', actor: '#7A4A30' } as const;
const HEADER_BG = '#7C4A1E';

function thStyle(width?: string) {
  return { borderColor: '#E5E2DD', width } as React.CSSProperties;
}

export function HldStyleViewDiagram({
  model,
  onRegenerate,
  regenerating,
}: {
  model: StyleViewModel;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const tiers = (model.tiers ?? []).filter((t) => t.applicable !== false);
  const choices = model.architecturalChoices ?? [];
  const tierPatterns = model.tierPatterns ?? [];
  const mp = model.modulePattern;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: T.bandTitle }}>Architecture Style &amp; Patterns View</span>
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

        {/* Actors row */}
        {(model.actors ?? []).length > 0 && (
          <div className="rounded-lg border p-2.5" style={{ background: '#FFF1EA', borderColor: '#E8BFA8' }}>
            <p className="text-[11px] font-semibold mb-1.5" style={{ color: T.actor }}>Actors</p>
            <div className="flex flex-wrap gap-1.5">
              {model.actors!.map((a, i) => (
                <span key={i} className="text-[11px] rounded-full px-2.5 py-0.5 border" style={{ background: '#FFF8F4', borderColor: '#E8BFA8', color: T.actor }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Architectural tiers — each with its pattern caption + components */}
        {tiers.map((t) => {
          const tone = TONES[t.key] ?? FALLBACK_TONE;
          return (
            <div key={t.key} className="rounded-lg border p-3" style={{ background: tone.fill, borderColor: tone.border }}>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-[13px] font-semibold" style={{ color: tone.title }}>{t.name}</p>
                {t.pattern && t.pattern !== '—' && (
                  <span className="text-[10px] italic ml-auto" style={{ color: tone.title }}>{t.pattern}</span>
                )}
              </div>
              {(t.components ?? []).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {t.components!.map((c, ci) => (
                    <div key={ci} className="rounded-md border bg-white/70 px-2.5 py-1.5" style={{ borderColor: tone.border }}>
                      <div className="text-[12px] font-medium leading-tight" style={{ color: tone.title }}>{c.name}</div>
                      {c.subtext && <div className="text-[10px] leading-tight mt-0.5" style={{ color: tone.title, opacity: 0.85 }}>{c.subtext}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* §6.1 — What this view tells you that the others do not */}
        {choices.length > 0 && (
          <div className="pt-3 mt-1 border-t">
            <p className="text-[13px] font-semibold mb-2" style={{ color: T.bandTitle }}>6.1 · What this view tells you that the others do not</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: HEADER_BG }}>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('28%')}>Architectural choice</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle()}>What the diagram makes explicit</th>
                  </tr>
                </thead>
                <tbody>
                  {choices.map((c, i) => (
                    <tr key={i} className="align-top">
                      <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{c.choice}</td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>{c.explicit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* §6.2 — Design patterns visible in this view */}
        {tierPatterns.length > 0 && (
          <div className="pt-3 mt-1 border-t">
            <p className="text-[13px] font-semibold mb-2" style={{ color: T.bandTitle }}>6.2 · Design patterns visible in this view</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: HEADER_BG }}>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('24%')}>Tier</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle()}>Patterns applied</th>
                  </tr>
                </thead>
                <tbody>
                  {tierPatterns.map((tp, i) => (
                    <tr key={i} className="align-top">
                      <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{tp.tier}</td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>{tp.patterns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* §6.3 — The 3-Tier Module Pattern */}
        {mp && (
          <div className="pt-3 mt-1 border-t">
            <p className="text-[13px] font-semibold mb-1.5" style={{ color: T.bandTitle }}>6.3 · The 3-Tier Module Pattern</p>
            {mp.note && <p className="text-[12px] leading-snug mb-2" style={{ color: T.caption }}>{mp.note}</p>}
            {mp.applicable !== false && (mp.tiers ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr style={{ background: HEADER_BG }}>
                      <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('8%')}>Tier</th>
                      <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('22%')}>Service archetype</th>
                      <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('20%')}>Stack</th>
                      <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle()}>Responsibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mp.tiers!.map((mt, i) => (
                      <tr key={i} className="align-top" style={mt.mustHave === false ? { background: '#FAFAF9' } : undefined}>
                        <td className="border px-2.5 py-1.5 font-semibold" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>
                          {mt.tier}{mt.mustHave ? ' *' : ''}
                        </td>
                        <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{mt.archetype ?? ''}</td>
                        <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: T.caption }}>{mt.stack ?? ''}</td>
                        <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>{mt.responsibility ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {mp.applicable !== false && (mp.forcingFunctions ?? []).length > 0 && (
              <div className="overflow-x-auto mt-2">
                <p className="text-[12px] font-medium mb-1" style={{ color: T.bandTitle }}>When to break the optional tiers out of M1</p>
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr style={{ background: HEADER_BG }}>
                      <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('34%')}>Service to extract</th>
                      <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle()}>Forcing function</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mp.forcingFunctions!.map((f, i) => (
                      <tr key={i} className="align-top">
                        <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{f.service}</td>
                        <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>{f.trigger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] mt-1" style={{ color: T.caption }}>* M1/M2/M3 are mandatory; O1/O2 start collapsed inside M1 until a forcing function appears.</p>
              </div>
            )}
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
