'use client';

/**
 * FreshnessBanner (Sprint v6 · Track T · T-03).
 *
 * Shows an amber banner on a downstream page when its artifact(s) were built from
 * a superseded PRD/HLD version — the forward-propagation signal. Driven by
 * `GET /freshness` (version-staleness). Renders nothing when everything is current.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getArtifactFreshness, type FreshnessEntry } from '@/lib/pipeline-api';

interface FreshnessBannerProps {
  projectId: string;
  /** Restrict to one artifact type; omit to show all stale downstream artifacts. */
  artifactType?: 'HLD' | 'E2E_FLOW';
}

export function FreshnessBanner({ projectId, artifactType }: FreshnessBannerProps) {
  const [stale, setStale] = useState<FreshnessEntry[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const report = await getArtifactFreshness(projectId);
        if (!active) return;
        const entries = report.downstream
          .filter((d) => d.stale)
          .filter((d) => !artifactType || d.artifactType === artifactType);
        setStale(entries);
      } catch {
        // freshness is advisory — never block the page
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, artifactType]);

  if (!stale.length) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
      <p className="font-medium flex items-center gap-1.5">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {stale.length === 1
          ? 'This artifact may be out of date with the latest requirements.'
          : `${stale.length} artifacts may be out of date with the latest requirements.`}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {stale.map((d) => (
          <li key={`${d.artifactType}-${d.id}`} className="text-xs text-amber-700">
            <span className="font-medium">{d.label}</span> — {d.reason}
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
        <RefreshCw className="h-3 w-3" /> Review or regenerate to bring it in line with the current PRD/HLD.
      </p>
    </div>
  );
}
