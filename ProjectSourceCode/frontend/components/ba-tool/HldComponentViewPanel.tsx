'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getHldComponentView, regenerateHldComponentView, type ComponentViewModel } from '@/lib/pipeline-api';
import { HldComponentViewDiagram } from './HldComponentViewDiagram';

/**
 * Fetches (and caches) the Detailed Component View (§5) model for an HLD and
 * renders the enriched layered diagram + §5.1 conventions + §5.2 table. First
 * build derives it from the PRD/FRD/HLD (~20–40s).
 */
export function HldComponentViewPanel({
  projectId,
  hldId,
  onNavigateSection,
}: {
  projectId: string;
  hldId: string;
  onNavigateSection?: (sectionKey: string) => void;
}) {
  const [model, setModel] = useState<ComponentViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getHldComponentView(projectId, hldId)
      .then((m) => !cancelled && setModel(m))
      .catch((e) =>
        !cancelled &&
        setError(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (e instanceof Error ? e.message : 'Failed to build the Detailed Component View'),
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
      setModel(await regenerateHldComponentView(projectId, hldId));
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
          <Loader2 className="h-4 w-4 animate-spin" /> Building the Detailed Component View… (first time ~20–40s)
        </CardContent>
      </Card>
    );
  }
  if (error || !model) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-amber-700 flex items-center justify-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {error ?? 'No Detailed Component View yet.'}
          </p>
          <Button size="sm" onClick={regen} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Build Detailed Component View
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <HldComponentViewDiagram
      model={model}
      onRegenerate={regen}
      regenerating={regenerating}
      onNavigateSection={onNavigateSection}
    />
  );
}
