'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  getDiscoveryHifiScreen,
  getLatestDiscoveryHifi,
  type BaProject,
  type BaHifiScreen,
} from '@/lib/ba-api';
import { HifiScreenViewer } from '@/components/ba-tool/discovery/HifiScreenViewer';

export default function HifiScreenPage() {
  const params = useParams<{ id: string; screenId: string }>();
  const router = useRouter();
  const projectId = params.id;
  const screenId = params.screenId;

  const [project, setProject] = useState<BaProject | null>(null);
  const [screen, setScreen] = useState<BaHifiScreen | null>(null);
  const [ctaColor, setCtaColor] = useState<string>('#F97316');
  /** Sibling screens (sorted by sequenceNum) — required for the click-through feature. */
  const [siblings, setSiblings] = useState<BaHifiScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await getDiscoveryHifiScreen(projectId, screenId);
      setScreen(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh screen';
      setError(msg);
    }
  }, [projectId, screenId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, s, latestSet] = await Promise.all([
          getBaProject(projectId),
          getDiscoveryHifiScreen(projectId, screenId),
          getLatestDiscoveryHifi(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setScreen(s);
        if (latestSet?.brandTokensSnapshot?.cta) {
          setCtaColor(String(latestSet.brandTokensSnapshot.cta));
        }
        setSiblings(latestSet?.screens ?? []);
      } catch {
        if (!cancelled) setError('Failed to load hi-fi screen');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, screenId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !screen) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <div className="text-sm text-destructive">{error ?? 'Hi-fi screen not found'}</div>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center text-xs text-muted-foreground">
        <Link href={`/ba-tool/project/${projectId}`} className="hover:text-foreground">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3 w-3 mx-1" />
        <Link href={`/ba-tool/project/${projectId}/discovery`} className="hover:text-foreground">
          Discovery
        </Link>
        <ChevronRight className="h-3 w-3 mx-1" />
        <Link
          href={`/ba-tool/project/${projectId}/discovery/hifi`}
          className="hover:text-foreground"
        >
          Hi-fi
        </Link>
        <ChevronRight className="h-3 w-3 mx-1" />
        <span className="text-foreground font-medium">
          {String(screen.sequenceNum).padStart(2, '0')} {screen.title}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">
            <span className="text-muted-foreground font-mono mr-2">
              {String(screen.sequenceNum).padStart(2, '0')}
            </span>
            {screen.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {(screen.callouts ?? []).length} callouts ·{' '}
            {screen.parityStatus?.ok ? 'parity ✓' : 'parity ⚠'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/hifi`)}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to gallery
        </Button>
      </div>

      <HifiScreenViewer
        projectId={projectId}
        screen={screen}
        ctaColor={ctaColor}
        onUpdated={reload}
        siblings={siblings}
      />
    </div>
  );
}
