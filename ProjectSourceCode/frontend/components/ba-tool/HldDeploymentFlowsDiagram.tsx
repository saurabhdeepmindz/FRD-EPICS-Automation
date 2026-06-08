'use client';

import { Card, CardContent } from '@/components/ui/card';
import { buildFlowDiagramSvg } from '@/lib/aws-flow-diagram';
import type { DeploymentFlowsModel, FlowDiagram } from '@/lib/pipeline-api';

/**
 * AWS Flow Diagrams (§7.5) — renders the per-flow diagrams + the consolidated
 * end-to-end as AWS reference-architecture SVGs (left-to-right tiers, real AWS
 * icons, elbow connectors). Uses the SAME pure-string renderer as the PDF export
 * (lib/aws-flow-diagram), injected via dangerouslySetInnerHTML so screen and PDF
 * match exactly.
 */
export function HldDeploymentFlowsDiagram({
  model,
  onRegenerate,
  regenerating,
}: {
  model: DeploymentFlowsModel;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const perFlow = model.diagrams ?? [];
  const consolidated = model.consolidated;

  const FlowBlock = ({ d, idx }: { d: FlowDiagram; idx: number }) => (
    <div id={`deploy-flow-${idx}`} className="scroll-mt-6">
      <p className="text-[12px] font-semibold" style={{ color: '#141413' }}>{d.title ?? 'Flow'}</p>
      {d.description && <p className="text-[11px] leading-snug mb-1" style={{ color: '#3D3D3A' }}>{d.description}</p>}
      <div className="overflow-x-auto rounded-md border bg-white p-2" style={{ borderColor: '#E5E2DD' }}
        dangerouslySetInnerHTML={{ __html: buildFlowDiagramSvg(d) }} />
    </div>
  );

  return (
    <Card>
      <CardContent id="deploy-flows" className="p-4 space-y-3 scroll-mt-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: '#141413' }}>7.5 · AWS flow diagrams</span>
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
        {perFlow.map((d, i) => (
          <FlowBlock key={d.id ?? i} d={d} idx={i} />
        ))}
        {consolidated && (
          <div className="pt-2 mt-1 border-t">
            <FlowBlock d={consolidated} idx={perFlow.length} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
