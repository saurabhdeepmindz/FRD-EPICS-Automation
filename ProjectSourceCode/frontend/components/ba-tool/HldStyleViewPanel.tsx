'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getHldStyleView, regenerateHldStyleView, type StyleViewModel } from '@/lib/pipeline-api';
import { HldStyleViewDiagram } from './HldStyleViewDiagram';

/**
 * Fetches (and caches) the Architecture Style & Patterns View (§6) model for an
 * HLD and renders the actors + tiers diagram with the §6.1/§6.2/§6.3 tables.
 * First build derives it from the PRD/FRD/HLD (~20–40s).
 */
export function HldStyleViewPanel({ projectId, hldId }: { projectId: string; hldId: string }) {
  const [model, setModel] = useState<StyleViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getHldStyleView(projectId, hldId)
      .then((m) => !cancelled && setModel(m))
      .catch((e) =>
        !cancelled &&
        setError(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (e instanceof Error ? e.message : 'Failed to build the Architecture Style & Patterns View'),
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
      setModel(await regenerateHldStyleView(projectId, hldId));
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
          <Loader2 className="h-4 w-4 animate-spin" /> Building the Architecture Style &amp; Patterns View… (first time ~20–40s)
        </CardContent>
      </Card>
    );
  }
  if (error || !model) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-amber-700 flex items-center justify-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {error ?? 'No Architecture Style & Patterns View yet.'}
          </p>
          <Button size="sm" onClick={regen} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Build Style &amp; Patterns View
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <HldStyleViewDiagram model={model} onRegenerate={regen} regenerating={regenerating} />;
}
