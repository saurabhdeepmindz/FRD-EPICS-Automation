'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPrds, deletePrd } from '@/lib/api';
import type { Prd } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, FileText, Trash2, Loader2, Eye, Edit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function statusColor(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-amber-100 text-amber-700';
    case 'UNDER_REVIEW':
      return 'bg-blue-100 text-blue-700';
    case 'APPROVED':
      return 'bg-green-100 text-green-700';
    case 'BASELINED':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function completionPercent(sections: { status: string }[]): number {
  if (sections.length === 0) return 0;
  const done = sections.filter((s) => s.status === 'COMPLETE').length;
  return Math.round((done / sections.length) * 100);
}

export default function DashboardPage() {
  const [prds, setPrds] = useState<Prd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listPrds()
      .then(setPrds)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load PRDs';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this PRD? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deletePrd(id);
      setPrds((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert('Failed to delete PRD');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 max-w-6xl mx-auto" data-testid="dashboard">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My PRDs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Product Requirements Documents
          </p>
        </div>
        <Button asChild data-testid="btn-new-prd">
          <Link href="/prd/new">
            <Plus className="h-4 w-4 mr-1" />
            Create New PRD
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && prds.length === 0 && (
        <div className="text-center py-16" data-testid="empty-state">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No PRDs yet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first Product Requirements Document to get started.
          </p>
          <Button asChild>
            <Link href="/prd/new">
              <Plus className="h-4 w-4 mr-1" />
              Create New PRD
            </Link>
          </Button>
        </div>
      )}

      {!loading && !error && prds.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3" data-testid="prd-list">
          {prds.map((prd) => {
            const pct = completionPercent(prd.sections);
            return (
              <Card key={prd.id} className="hover:shadow-md transition-shadow" data-testid={`prd-card-${prd.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{prd.productName}</CardTitle>
                      <CardDescription className="text-xs mt-1">{prd.prdCode}</CardDescription>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(prd.status)}`}>
                      {prd.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Completion</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>v{prd.version}</span>
                    <span>{new Date(prd.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/prd/${prd.id}/edit`}>
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/prd/${prd.id}/preview`}>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Preview
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(prd.id)}
                      disabled={deleting === prd.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting === prd.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
