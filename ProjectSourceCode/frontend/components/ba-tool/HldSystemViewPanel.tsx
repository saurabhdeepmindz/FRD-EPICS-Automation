'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getHldSystemView, regenerateHldSystemView, type SystemViewModel } from '@/lib/pipeline-api';
import { HldSystemViewDiagram } from './HldSystemViewDiagram';

/**
 * Fetches (and caches) the 50,000-ft System View band model for an HLD and renders
 * the layered diagram. First build derives it from the PRD/FRD/HLD (~20–40s).
 */
export function HldSystemViewPanel({ projectId, hldId }: { projectId: string; hldId: string }) {
  const [model, setModel] = useState<SystemViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getHldSystemView(projectId, hldId)
      .then((m) => !cancelled && setModel(m))
      .catch((e) =>
        !cancelled &&
        setError(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (e instanceof Error ? e.message : 'Failed to build the System View'),
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
      setModel(await regenerateHldSystemView(projectId, hldId));
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
          <Loader2 className="h-4 w-4 animate-spin" /> Building the 50,000-ft System View… (first time ~20–40s)
        </CardContent>
      </Card>
    );
  }
  if (error || !model) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-amber-700 flex items-center justify-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {error ?? 'No System View yet.'}
          </p>
          <Button size="sm" onClick={regen} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Build System View
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <HldSystemViewDiagram model={model} onRegenerate={regen} regenerating={regenerating} />;
}
