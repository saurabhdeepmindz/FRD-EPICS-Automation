'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getHldDeploymentFlows, regenerateHldDeploymentFlows, type DeploymentFlowsModel } from '@/lib/pipeline-api';
import { HldDeploymentFlowsDiagram } from './HldDeploymentFlowsDiagram';

/**
 * Fetches (and caches) the AWS Flow Diagrams (§7.5) model for an HLD and renders
 * the per-flow + consolidated reference-architecture diagrams. First build derives
 * it from the PRD/FRD/HLD + the §7 deployment view (~20–40s).
 */
export function HldDeploymentFlowsPanel({ projectId, hldId }: { projectId: string; hldId: string }) {
  const [model, setModel] = useState<DeploymentFlowsModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getHldDeploymentFlows(projectId, hldId)
      .then((m) => !cancelled && setModel(m))
      .catch((e) =>
        !cancelled &&
        setError(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (e instanceof Error ? e.message : 'Failed to build the AWS Flow Diagrams'),
        ),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, hldId]);

  const regen = async () => {
    setRegenerating(true);
    setError(null);
    try {
      setModel(await regenerateHldDeploymentFlows(projectId, hldId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent id="deploy-flows" className="py-10 flex items-center justify-center gap-2 text-sm text-gray-400 scroll-mt-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Building the AWS flow diagrams… (first time ~20–40s)
        </CardContent>
      </Card>
    );
  }
  if (error || !model) {
    return (
      <Card>
        <CardContent id="deploy-flows" className="py-8 text-center space-y-3 scroll-mt-6">
          <p className="text-sm text-amber-700 flex items-center justify-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {error ?? 'No AWS flow diagrams yet.'}
          </p>
          <Button size="sm" onClick={regen} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Build flow diagrams
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <HldDeploymentFlowsDiagram model={model} onRegenerate={regen} regenerating={regenerating} />;
}
