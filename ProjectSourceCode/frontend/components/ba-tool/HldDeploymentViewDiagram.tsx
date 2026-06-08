'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { AwsIcon, AWS_FAMILY_LABELS, normAwsFamily, type AwsFamily } from '@/lib/aws-icons';
import type { DeploymentViewModel, DeploymentService } from '@/lib/pipeline-api';

/**
 * AWS Deployment View (§7) — a layered AWS service-catalogue diagram (Users/Edge →
 * Compute → Async → Data → cross-cutting), each service rendered as an AWS-style
 * icon tile, followed by §7.1 service mapping, §7.2 serverless choices, §7.3 what
 * is not in the view, and §7.4 how it evolves. HTML/CSS so it exports cleanly to
 * PDF/DOCX (mirrors the export-side renderer in hld-html.ts).
 */

const T = { caption: '#3D3D3A', bandTitle: '#141413' } as const;
const HEADER_BG = '#7C4A1E';

function thStyle(width?: string) {
  return { borderColor: '#E5E2DD', width } as React.CSSProperties;
}

function Tile({ s }: { s: DeploymentService }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-white px-2 py-1.5" style={{ borderColor: '#E5E2DD', minWidth: 124 }}>
      <AwsIcon family={s.family} size={34} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[11px] font-semibold truncate" style={{ color: T.bandTitle }}>{s.name}</span>
        {s.subtext && <span className="text-[9px] leading-tight" style={{ color: '#64748b' }}>{s.subtext}</span>}
      </div>
    </div>
  );
}

function Row({ services }: { services?: DeploymentService[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(services ?? []).map((s, i) => (
        <Tile key={i} s={s} />
      ))}
    </div>
  );
}

export function HldDeploymentViewDiagram({
  model,
  onRegenerate,
  regenerating,
}: {
  model: DeploymentViewModel;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const layers = (model.layers ?? []).filter((l) => l.applicable !== false);
  const outOfScope = (model.layers ?? []).filter((l) => l.applicable === false);
  const mapping = model.serviceMapping ?? [];
  const sl = model.serverless;
  const notIn = model.notInView ?? [];
  const evolution = model.evolution ?? [];

  const usedFamilies = new Set<AwsFamily>();
  layers.forEach((l) => {
    (l.services ?? []).forEach((s) => usedFamilies.add(normAwsFamily(s.family)));
    (l.subGroups ?? []).forEach((g) => (g.services ?? []).forEach((s) => usedFamilies.add(normAwsFamily(s.family))));
  });

  const meta = [model.cloud, model.region ? `Region: ${model.region}` : '', model.account ? `Account: ${model.account}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: T.bandTitle }}>AWS Deployment View</span>
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
        {meta && <p className="text-[11px] font-semibold" style={{ color: '#7C4A1E' }}>{meta}</p>}
        {model.scopeNote && <p className="text-[11px] leading-snug" style={{ color: T.caption }}>{model.scopeNote}</p>}

        {/* Service-catalogue bands */}
        <div id="deploy-diagram" className="space-y-2 scroll-mt-6">
          {layers.map((l) => (
            <div key={l.key} className="rounded-lg border p-2.5" style={{ background: '#F8FAFC', borderColor: '#E5E2DD' }}>
              <p className="text-[12px] font-semibold mb-2" style={{ color: T.bandTitle }}>{l.name}</p>
              {l.subGroups?.length ? (
                <div className="space-y-2">
                  {l.subGroups.map((g, gi) => (
                    <div key={gi}>
                      <p className="text-[10px] font-semibold mb-1" style={{ color: '#475569' }}>{g.label}</p>
                      <Row services={g.services} />
                    </div>
                  ))}
                </div>
              ) : (
                <Row services={l.services} />
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        {usedFamilies.size > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
            {[...usedFamilies].map((f) => (
              <span key={f} className="flex items-center gap-1 text-[9.5px]" style={{ color: '#475569' }}>
                <AwsIcon family={f} size={14} /> {AWS_FAMILY_LABELS[f]}
              </span>
            ))}
          </div>
        )}

        {outOfScope.map((l) => (
          <p key={l.key} className="text-[11px]" style={{ color: '#92400e' }}>
            <strong>{l.name}:</strong> Out of scope{l.outOfScope ? ` — ${l.outOfScope}` : ''}
          </p>
        ))}

        {/* §7.1 — AWS service mapping */}
        {mapping.length > 0 && (
          <div id="deploy-mapping" className="pt-3 mt-1 border-t scroll-mt-6">
            <p className="text-[13px] font-semibold mb-2" style={{ color: T.bandTitle }}>7.1 · AWS service mapping — HLD layer to AWS service</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: HEADER_BG }}>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('16%')}>HLD layer</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('22%')}>Component</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('20%')}>AWS service</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle()}>Rationale and trade-offs</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((r, i) => (
                    <tr key={i} className="align-top">
                      <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{r.hldLayer}</td>
                      <td className="border px-2.5 py-1.5" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>{r.component}</td>
                      <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{r.awsService}</td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>{r.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* §7.2 — Serverless choices */}
        {sl && (
          <div id="deploy-serverless" className="pt-3 mt-1 border-t scroll-mt-6">
            <p className="text-[13px] font-semibold mb-1.5" style={{ color: T.bandTitle }}>7.2 · Serverless choices — where Lambda fits</p>
            {sl.intro && <p className="text-[12px] leading-snug mb-1.5" style={{ color: T.caption }}>{sl.intro}</p>}
            {(sl.patterns ?? []).length > 0 && (
              <ul className="space-y-1 list-disc pl-4">
                {sl.patterns!.map((p, i) => (
                  <li key={i} className="text-[12px] leading-snug" style={{ color: '#3D3D3A' }}>
                    <strong>{p.pattern}</strong> — {p.detail}
                  </li>
                ))}
              </ul>
            )}
            {sl.closing && <p className="text-[12px] leading-snug mt-1.5" style={{ color: T.caption }}>{sl.closing}</p>}
          </div>
        )}

        {/* §7.3 — What is deliberately NOT in this view */}
        {notIn.length > 0 && (
          <div id="deploy-notinview" className="pt-3 mt-1 border-t scroll-mt-6">
            <p className="text-[13px] font-semibold mb-1.5" style={{ color: T.bandTitle }}>7.3 · What is deliberately NOT in this view</p>
            <ul className="space-y-1 list-disc pl-4">
              {notIn.map((n, i) => (
                <li key={i} className="text-[12px] leading-snug" style={{ color: '#3D3D3A' }}>
                  <strong>{n.item}</strong> — {n.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* §7.4 — How this view evolves */}
        {evolution.length > 0 && (
          <div id="deploy-evolution" className="pt-3 mt-1 border-t scroll-mt-6">
            <p className="text-[13px] font-semibold mb-2" style={{ color: T.bandTitle }}>7.4 · How this view evolves</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: HEADER_BG }}>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle('28%')}>When</th>
                    <th className="border px-2.5 py-1.5 font-semibold text-white" style={thStyle()}>What is added to this view</th>
                  </tr>
                </thead>
                <tbody>
                  {evolution.map((e, i) => (
                    <tr key={i} className="align-top">
                      <td className="border px-2.5 py-1.5 font-medium" style={{ borderColor: '#E5E2DD', color: T.bandTitle }}>{e.when}</td>
                      <td className="border px-2.5 py-1.5 leading-snug" style={{ borderColor: '#E5E2DD', color: '#3D3D3A' }}>{e.added}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
