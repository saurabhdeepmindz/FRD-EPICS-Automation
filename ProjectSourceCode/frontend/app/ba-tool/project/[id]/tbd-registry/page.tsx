'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  getBaProject,
  listTbdEntries,
  resolveTbdEntry,
  type BaProject,
  type BaTbdFutureEntry,
} from '@/lib/ba-api';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function TbdRegistryPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [entries, setEntries] = useState<BaTbdFutureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveInterface, setResolveInterface] = useState('');
  const [showResolveFor, setShowResolveFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, tbd] = await Promise.all([getBaProject(projectId), listTbdEntries(projectId)]);
      setProject(proj);
      setEntries(tbd);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = useCallback(async (entryId: string) => {
    if (!resolveInterface.trim()) return;
    setResolvingId(entryId);
    try {
      await resolveTbdEntry(entryId, resolveInterface.trim());
      setShowResolveFor(null);
      setResolveInterface('');
      load();
    } catch {
      alert('Failed to resolve entry');
    } finally {
      setResolvingId(null);
    }
  }, [resolveInterface, load]);

  const unresolvedCount = entries.filter((e) => !e.isResolved).length;
  const resolvedCount = entries.filter((e) => e.isResolved).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading registry...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="tbd-registry">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/ba-tool/project/${projectId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Project
              </Link>
            </Button>
            <div>
              <h1 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                TBD-Future Integration Registry
              </h1>
              <p className="text-xs text-muted-foreground">{project?.name} — {project?.projectCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" /> {unresolvedCount} unresolved
            </span>
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" /> {resolvedCount} resolved
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No TBD-Future entries yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              TBD-Future entries are created when cross-module integrations are identified during skill execution.
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'rounded-lg border overflow-hidden',
                entry.isResolved ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30',
              )}
              data-testid={`tbd-entry-${entry.registryId}`}
            >
              {/* Entry header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {entry.isResolved ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold">{entry.registryId}</span>
                      <span className="text-sm font-semibold">{entry.integrationName}</span>
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                        entry.classification.includes('INTERNAL') ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
                      )}>
                        {entry.classification}
                      </span>
                    </div>
                    {entry.referencedModule && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        References: <span className="font-mono">{entry.referencedModule}</span>
                      </p>
                    )}
                  </div>
                </div>
                {entry.isResolved ? (
                  <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                    Resolved {entry.resolvedAt ? new Date(entry.resolvedAt).toLocaleDateString() : ''}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowResolveFor(entry.id); setResolveInterface(entry.assumedInterface); }}
                    className="text-amber-700 border-amber-300 hover:bg-amber-100"
                  >
                    Resolve
                  </Button>
                )}
              </div>

              {/* Entry details */}
              <div className="px-4 pb-3 space-y-2">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">Assumed Interface:</span>
                  <pre className="mt-1 text-xs font-mono bg-white/50 rounded p-2 whitespace-pre-wrap border border-border/50">
                    {entry.assumedInterface}
                  </pre>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-semibold">Resolution Trigger:</span> {entry.resolutionTrigger}
                  </span>
                </div>
                {entry.appearsInFeatures.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground">Appears in:</span>
                    {entry.appearsInFeatures.map((fId) => (
                      <span key={fId} className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {fId}
                      </span>
                    ))}
                  </div>
                )}

                {/* Resolved interface */}
                {entry.isResolved && entry.resolvedInterface && (
                  <div>
                    <span className="text-xs font-semibold text-green-700">Confirmed Interface:</span>
                    <pre className="mt-1 text-xs font-mono bg-green-50 rounded p-2 whitespace-pre-wrap border border-green-200">
                      {entry.resolvedInterface}
                    </pre>
                  </div>
                )}

                {/* Resolve form */}
                {showResolveFor === entry.id && !entry.isResolved && (
                  <div className="mt-3 p-3 rounded-md border border-primary/30 bg-card space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                      Confirmed Interface (update from assumed if different):
                    </label>
                    <textarea
                      value={resolveInterface}
                      onChange={(e) => setResolveInterface(e.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-input px-3 py-2 text-xs font-mono bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleResolve(entry.id)}
                        disabled={resolvingId === entry.id || !resolveInterface.trim()}
                      >
                        {resolvingId === entry.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        Confirm Resolution
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowResolveFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
