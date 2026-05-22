'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  getDiscoveryWireframeScreen,
  type BaProject,
  type BaWireframeScreen,
} from '@/lib/ba-api';
import { WireframeScreenViewer } from '@/components/ba-tool/discovery/WireframeScreenViewer';

export default function WireframeScreenPage() {
  const params = useParams<{ id: string; screenId: string }>();
  const router = useRouter();
  const projectId = params.id;
  const screenId = params.screenId;

  const [project, setProject] = useState<BaProject | null>(null);
  const [screen, setScreen] = useState<BaWireframeScreen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await getDiscoveryWireframeScreen(projectId, screenId);
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
        const [p, s] = await Promise.all([
          getBaProject(projectId),
          getDiscoveryWireframeScreen(projectId, screenId),
        ]);
        if (cancelled) return;
        setProject(p);
        setScreen(s);
      } catch {
        if (!cancelled) setError('Failed to load wireframe screen');
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
            <div className="text-sm text-destructive">{error ?? 'Screen not found'}</div>
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
          href={`/ba-tool/project/${projectId}/discovery/wireframes`}
          className="hover:text-foreground"
        >
          Wireframes
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
            {screen.pattern ?? '—'} · {(screen.callouts ?? []).length} callouts
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/wireframes`)}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to gallery
        </Button>
      </div>

      <WireframeScreenViewer projectId={projectId} screen={screen} onUpdated={reload} />
    </div>
  );
}
