'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  WIREFRAME_PATTERNS,
  type BaWireframeSet,
  type BaWireframeScreen,
} from '@/lib/ba-api';
import { ScreenDownloadMenu } from '@/components/ba-tool/discovery/ScreenDownloadMenu';

interface WireframeSetEditorProps {
  projectId: string;
  set: BaWireframeSet;
  onRegenerate: () => void;
  regenerating: boolean;
}

export function WireframeSetEditor({
  projectId,
  set,
  onRegenerate,
  regenerating,
}: WireframeSetEditorProps) {
  const router = useRouter();
  const screens = set.screens ?? [];
  const coverage = set.coverageStatus;

  return (
    <div className="space-y-4">
      {/* Header + regenerate */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wireframe set · {screens.length} screens
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Generated {new Date(set.createdAt).toLocaleString()}
              {set.meta?.model && <> · model: <span className="font-mono">{set.meta.model}</span></>}
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onRegenerate} disabled={regenerating}>
            {regenerating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Regenerate
          </Button>
        </CardContent>
      </Card>

      {/* Coverage validator status */}
      {coverage && <CoverageStatusPanel coverage={coverage} />}

      {/* Screen gallery */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Screen gallery
            </div>
            {screens.length > 0 && (
              <ScreenDownloadMenu
                projectId={projectId}
                kind="lofi"
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
                <ScreenCard
                  key={screen.id}
                  projectId={projectId}
                  screen={screen}
                  onClick={() =>
                    router.push(
                      `/ba-tool/project/${projectId}/discovery/wireframes/${screen.id}`,
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Traceability matrix */}
      {screens.length > 0 && <TraceabilityMatrix screens={screens} brandTokens={set.brandTokensSnapshot} />}
    </div>
  );
}

// ─── Coverage status panel ──────────────────────────────────────────────────

function CoverageStatusPanel({
  coverage,
}: {
  coverage: NonNullable<BaWireframeSet['coverageStatus']>;
}) {
  const allGood = coverage.validated;
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
            Coverage validation {allGood ? '✓ all green' : '⚠ has gaps'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>
            {coverage.totalScreens} screens · {coverage.totalCallouts} callouts · {coverage.totalFrs} FRs in BRD
          </div>
          {coverage.orphanFrs.length > 0 && (
            <div className="text-amber-700 dark:text-amber-400">
              <strong>{coverage.orphanFrs.length} orphan FR{coverage.orphanFrs.length === 1 ? '' : 's'}</strong>{' '}
              (not referenced by any screen): <span className="font-mono">{coverage.orphanFrs.join(', ')}</span>
            </div>
          )}
          {coverage.orphanScreens.length > 0 && (
            <div className="text-amber-700 dark:text-amber-400">
              <strong>{coverage.orphanScreens.length} orphan screen{coverage.orphanScreens.length === 1 ? '' : 's'}</strong>{' '}
              (no callouts): #{coverage.orphanScreens.join(', #')}
            </div>
          )}
          {coverage.notes && <div className="italic">{coverage.notes}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Screen thumbnail card ──────────────────────────────────────────────────

function ScreenCard({
  projectId,
  screen,
  onClick,
}: {
  projectId: string;
  screen: BaWireframeScreen;
  onClick: () => void;
}) {
  const calloutCount = screen.callouts?.length ?? 0;
  return (
    <div className="relative group border rounded-md overflow-hidden hover:shadow-md transition-shadow bg-background">
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center border-b text-muted-foreground/40">
          <Layers className="h-12 w-12" />
        </div>
        <div className="p-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground">{String(screen.sequenceNum).padStart(2, '0')}</span>
            <span className="text-sm font-semibold truncate">{screen.title}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {screen.pattern ?? '—'}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {calloutCount} callout{calloutCount === 1 ? '' : 's'}
          </div>
        </div>
      </button>
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ScreenDownloadMenu
          projectId={projectId}
          kind="lofi"
          scope="individual"
          targetId={screen.id}
          variant="icon"
          label={`Download screen ${String(screen.sequenceNum).padStart(2, '0')}`}
        />
      </div>
    </div>
  );
}

// ─── Traceability matrix ───────────────────────────────────────────────────

function TraceabilityMatrix({
  screens,
  brandTokens,
}: {
  screens: BaWireframeScreen[];
  brandTokens: { primary: string; cta: string };
}) {
  // Collect all FR IDs referenced anywhere
  const { frIds, matrix } = useMemo(() => {
    const idSet = new Set<string>();
    const m: Record<string, Set<number>> = {};
    for (const s of screens) {
      const ids = new Set<string>();
      for (const c of s.callouts ?? []) {
        if (c.mappedTo) {
          c.mappedTo.split(/[·,;]+/).forEach((token) => {
            const t = token.trim();
            if (/^FR-?\d+/i.test(t) || /^§/.test(t)) ids.add(t);
          });
        }
      }
      for (const id of ids) {
        idSet.add(id);
        if (!m[id]) m[id] = new Set<number>();
        m[id].add(s.sequenceNum);
      }
    }
    const sorted = [...idSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { frIds: sorted, matrix: m };
  }, [screens]);

  if (frIds.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Traceability matrix · FRs × screens
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-muted/40 border p-1.5 text-left font-semibold min-w-[140px]">
                  FR / §
                </th>
                {screens.map((s) => (
                  <th
                    key={s.id}
                    className="border p-1.5 font-mono text-center min-w-[36px]"
                    title={s.title}
                  >
                    {String(s.sequenceNum).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {frIds.map((fr) => (
                <tr key={fr}>
                  <td className="sticky left-0 bg-background border p-1.5 font-mono text-muted-foreground">
                    {fr}
                  </td>
                  {screens.map((s) => {
                    const hits = matrix[fr]?.has(s.sequenceNum);
                    return (
                      <td
                        key={s.id}
                        className="border p-1 text-center"
                        style={{
                          background: hits ? `${brandTokens.cta}33` : 'transparent',
                          color: hits ? brandTokens.cta : 'transparent',
                        }}
                      >
                        {hits ? '✓' : '·'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">
          ✓ = FR referenced as `mappedTo` on a callout in that screen.
        </div>
      </CardContent>
    </Card>
  );
}
