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

        {/* §17 intro + Three principles */}
        {(model.intro || (model.principles ?? []).length > 0) && (
          <div className="pt-3 mt-1 border-t">
            {model.intro && <p className="text-[12px] leading-snug mb-2" style={{ color: T.caption }}>{model.intro}</p>}
            {(model.principles ?? []).length > 0 && (
              <Table head={['Principle', 'How it shows up in the structure']} widths={['28%']}>
                {model.principles!.map((p, i) => (
                  <Row key={i} cells={[p.principle, p.how]} bold={[true, false]} />
                ))}
              </Table>
            )}
          </div>
        )}

        {/* §17.1 Backend (root layout) */}
        {model.backend && (
          <SubSection id="struct-backend" title={`17.1 · Backend project structure${model.backend.stack ? ` (${model.backend.stack})` : ''}`}>
            {model.backend.intro && <p className="text-[12px] leading-snug mb-2" style={{ color: T.caption }}>{model.backend.intro}</p>}
            {model.backend.rootTree && <><p className="text-[11px] font-medium mb-1" style={{ color: T.bandTitle }}>Root layout</p><Tree>{model.backend.rootTree}</Tree></>}
          </SubSection>
        )}

        {/* §17.2 Per-module structure */}
        {model.backend && (model.backend.perModuleTree || (model.backend.folderReference ?? []).length > 0) && (
          <SubSection id="struct-permodule" title="17.2 · Per-module structure — apps/[module]-api/">
            {model.backend.perModuleTree && <Tree>{model.backend.perModuleTree}</Tree>}
            {(model.backend.folderReference ?? []).length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-medium mb-1" style={{ color: T.bandTitle }}>Folder reference</p>
                <Table head={['Folder', 'POC', 'Purpose']} widths={['16%', '6%']}>
                  {model.backend.folderReference!.map((f, i) => (
                    <Row key={i} cells={[f.folder, f.poc ? '★' : '', f.purpose]} bold={[true, false, false]} mono={[true, false, false]} />
                  ))}
                </Table>
              </div>
            )}
          </SubSection>
        )}

        {/* §17.3 Frontend */}
        {model.frontend && (
          <SubSection id="struct-frontend" title={`17.3 · Frontend project structure${model.frontend.stack ? ` (${model.frontend.stack})` : ''}`}>
            {model.frontend.intro && <p className="text-[12px] leading-snug mb-2" style={{ color: T.caption }}>{model.frontend.intro}</p>}
            {model.frontend.rootTree && <><p className="text-[11px] font-medium mb-1" style={{ color: T.bandTitle }}>Root layout</p><Tree>{model.frontend.rootTree}</Tree></>}
            {(model.frontend.componentRule ?? []).length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-medium mb-1" style={{ color: T.bandTitle }}>The 3-tier shared-component rule</p>
                <Table head={['Scope', 'Location', 'Rule']} widths={['28%', '22%']}>
                  {model.frontend.componentRule!.map((c, i) => (
                    <Row key={i} cells={[c.scope, c.location, c.rule]} bold={[true, false, false]} mono={[false, true, false]} />
                  ))}
                </Table>
              </div>
            )}
            {model.frontend.promotionRule && <p className="text-[12px] leading-snug mt-2" style={{ color: T.caption }}><span className="font-medium" style={{ color: T.bandTitle }}>Promotion rule — </span>{model.frontend.promotionRule}</p>}
          </SubSection>
        )}

        {/* §17.4 AI Agent */}
        <SubSection id="struct-aiagent" title={`17.4 · AI Agent project structure${model.aiAgent?.applicable !== false && model.aiAgent?.stack ? ` (${model.aiAgent.stack})` : ''}`}>
          {model.aiAgent?.applicable === false ? (
            <p className="text-[12px] italic" style={{ color: '#9A968F' }}>{model.aiAgent?.note || 'Not applicable — no AI agent required for this project.'}</p>
          ) : (
            <>
              {model.aiAgent?.note && <p className="text-[12px] leading-snug mb-2" style={{ color: T.caption }}>{model.aiAgent.note}</p>}
              {model.aiAgent?.rootTree && <><p className="text-[11px] font-medium mb-1" style={{ color: T.bandTitle }}>Root layout — apps/[module]-ai-agent/</p><Tree>{model.aiAgent.rootTree}</Tree></>}
              {(model.aiAgent?.folderResponsibilities ?? []).length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-medium mb-1" style={{ color: T.bandTitle }}>Folder responsibilities</p>
                  <Table head={['Folder', 'POC', 'Purpose']} widths={['16%', '6%']}>
                    {model.aiAgent!.folderResponsibilities!.map((f, i) => (
                      <Row key={i} cells={[f.folder, f.poc ? '★' : '', f.purpose]} bold={[true, false, false]} mono={[true, false, false]} />
                    ))}
                  </Table>
                </div>
              )}
              {model.aiAgent?.runtimeInteraction && <><p className="text-[11px] font-medium mt-2 mb-1" style={{ color: T.bandTitle }}>How the platform pieces interact at runtime</p><Tree>{model.aiAgent.runtimeInteraction}</Tree></>}
            </>
          )}
        </SubSection>

        {/* §17.4 Naming conventions */}
        {(model.namingConventions ?? []).length > 0 && (
          <SubSection id="struct-naming" title="17.5 · Naming conventions across all stacks">
            <Table head={['Concern', 'Convention', 'Examples']} widths={['24%', '30%']}>
              {model.namingConventions!.map((n, i) => (
                <Row key={i} cells={[n.concern, n.convention, n.examples]} bold={[true, false, false]} mono={[false, false, true]} />
              ))}
            </Table>
          </SubSection>
        )}

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

function SubSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6 pt-3 mt-1 border-t">
      <p className="text-[13px] font-semibold mb-2" style={{ color: T.bandTitle }}>{title}</p>
      {children}
    </div>
  );
}

function Tree({ children }: { children: string }) {
  return (
    <pre
      className="text-[11px] leading-snug overflow-x-auto rounded-md border bg-gray-50 p-2.5 whitespace-pre"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', color: '#3D3D3A' }}
    >
      {children}
    </pre>
  );
}

function Table({ head, widths, children }: { head: string[]; widths?: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-[12px]">
        <thead>
          <tr style={{ background: '#7C4A1E' }}>
            {head.map((h, i) => (
              <th key={i} className="border px-2.5 py-1.5 font-semibold text-white" style={{ borderColor: '#E5E2DD', width: widths?.[i] }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ cells, bold, mono }: { cells: string[]; bold?: boolean[]; mono?: boolean[] }) {
  return (
    <tr className="align-top">
      {cells.map((c, i) => (
        <td
          key={i}
          className={`border px-2.5 py-1.5 leading-snug ${bold?.[i] ? 'font-medium' : ''}`}
          style={{
            borderColor: '#E5E2DD',
            color: bold?.[i] ? T.bandTitle : '#3D3D3A',
            fontFamily: mono?.[i] ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
          }}
        >
          {c || ''}
        </td>
      ))}
    </tr>
  );
}
