'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getHldDeploymentView, regenerateHldDeploymentView, type DeploymentViewModel } from '@/lib/pipeline-api';
import { HldDeploymentViewDiagram } from './HldDeploymentViewDiagram';

/**
 * Fetches (and caches) the AWS Deployment View (§7) model for an HLD and renders
 * the AWS service-catalogue diagram with the §7.1–§7.4 sub-sections. First build
 * derives it from the PRD/FRD/HLD (~20–40s).
 */
export function HldDeploymentViewPanel({ projectId, hldId }: { projectId: string; hldId: string }) {
  const [model, setModel] = useState<DeploymentViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getHldDeploymentView(projectId, hldId)
      .then((m) => !cancelled && setModel(m))
      .catch((e) =>
        !cancelled &&
        setError(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (e instanceof Error ? e.message : 'Failed to build the AWS Deployment View'),
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
      setModel(await regenerateHldDeploymentView(projectId, hldId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Building the AWS Deployment View… (first time ~20–40s)
        </CardContent>
      </Card>
    );
  }
  if (error || !model) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-amber-700 flex items-center justify-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {error ?? 'No AWS Deployment View yet.'}
          </p>
          <Button size="sm" onClick={regen} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Build Deployment View
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <HldDeploymentViewDiagram model={model} onRegenerate={regen} regenerating={regenerating} />;
}
