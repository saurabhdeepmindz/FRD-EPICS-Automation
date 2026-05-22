'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BaHifiSet, BaHifiScreen } from '@/lib/ba-api';
import { ScreenDownloadMenu } from '@/components/ba-tool/discovery/ScreenDownloadMenu';

interface HifiSetViewerProps {
  projectId: string;
  set: BaHifiSet;
  onRegenerate: () => void;
  regenerating: boolean;
}

export function HifiSetViewer({
  projectId,
  set,
  onRegenerate,
  regenerating,
}: HifiSetViewerProps) {
  const router = useRouter();
  const screens = set.screens ?? [];
  const parity = set.parityStatus;
  const ctaColor = String(set.brandTokensSnapshot?.cta ?? '#F97316');

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hi-fi mockup set · {screens.length} screens
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Generated {new Date(set.createdAt).toLocaleString()}
              {set.meta?.model && (
                <>
                  {' '}
                  · model: <span className="font-mono">{set.meta.model}</span>
                </>
              )}
            </div>
            {set.syntheticDataSeed?.notes && (
              <div className="text-[11px] text-muted-foreground mt-1 italic">
                Seed notes: {set.syntheticDataSeed.notes}
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Regenerate
          </Button>
        </CardContent>
      </Card>

      {parity && <ParityStatusPanel parity={parity} />}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Screen gallery
            </div>
            {screens.length > 0 && (
              <ScreenDownloadMenu
                projectId={projectId}
                kind="hifi"
                scope="bulk"
                targetId={set.id}
                label="Download all"
              />
            )}
          </div>
          {screens.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">No screens generated.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {screens.map((screen) => (
                <HifiScreenCard
                  key={screen.id}
                  projectId={projectId}
                  screen={screen}
                  ctaColor={ctaColor}
                  onClick={() =>
                    router.push(
                      `/ba-tool/project/${projectId}/discovery/hifi/${screen.id}`,
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ParityStatusPanel({
  parity,
}: {
  parity: NonNullable<BaHifiSet['parityStatus']>;
}) {
  const allGood = parity.validated;
  const failingScreens = parity.perScreen.filter((p) => !p.ok);
  return (
    <Card
      className={cn(
        allGood
          ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
          : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {allGood ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <span className="text-sm font-semibold">
            Callout-parity {allGood ? '✓ all green' : '⚠ has gaps'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>
            {parity.totalScreens} screens validated against lo-fi parent (skill 05 §7)
          </div>
          {failingScreens.map((s) => (
            <div key={s.sequenceNum} className="text-amber-700 dark:text-amber-400">
              <strong>Screen #{String(s.sequenceNum).padStart(2, '0')}</strong>
              {s.missing.length > 0 && (
                <>
                  {' '}
                  · missing: <span className="font-mono">{s.missing.join(', ')}</span>
                </>
              )}
              {s.invalidExtras.length > 0 && (
                <>
                  {' '}
                  · invalid extras (must be letter-suffixed):{' '}
                  <span className="font-mono">{s.invalidExtras.join(', ')}</span>
                </>
              )}
            </div>
          ))}
          {parity.notes && <div className="italic">{parity.notes}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function HifiScreenCard({
  projectId,
  screen,
  ctaColor,
  onClick,
}: {
  projectId: string;
  screen: BaHifiScreen;
  ctaColor: string;
  onClick: () => void;
}) {
  const calloutCount = screen.callouts?.length ?? 0;
  const parityOk = screen.parityStatus?.ok ?? true;
  return (
    <div className="relative group border rounded-md overflow-hidden hover:shadow-md transition-shadow bg-background">
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        <div className="aspect-[4/3] bg-white border-b overflow-hidden">
          {screen.htmlContent ? (
            <iframe
              title={`hifi-thumb-${screen.slug}`}
              sandbox=""
              srcDoc={screen.htmlContent}
              className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
              <LayoutGrid className="h-12 w-12" />
            </div>
          )}
        </div>
        <div className="p-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground">
              {String(screen.sequenceNum).padStart(2, '0')}
            </span>
            <span className="text-sm font-semibold truncate">{screen.title}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
            <span
              className="inline-flex h-3 w-3 rounded-full"
              style={{ background: ctaColor }}
              aria-hidden
            />
            {calloutCount} callout{calloutCount === 1 ? '' : 's'}
            {!parityOk && (
              <span className="text-amber-600 ml-1">⚠ parity gap</span>
            )}
          </div>
        </div>
      </button>
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ScreenDownloadMenu
          projectId={projectId}
          kind="hifi"
          scope="individual"
          targetId={screen.id}
          variant="icon"
          label={`Download screen ${String(screen.sequenceNum).padStart(2, '0')}`}
        />
      </div>
    </div>
  );
}
