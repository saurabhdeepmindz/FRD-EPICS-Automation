'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Edit3, Save, X, FileCode, FileText } from 'lucide-react';
import {
  updateDiscoveryWireframeScreen,
  type BaWireframeScreen,
} from '@/lib/ba-api';
import { MarkdownRenderer } from '@/components/ba-tool/MarkdownRenderer';

interface WireframeScreenViewerProps {
  projectId: string;
  screen: BaWireframeScreen;
  onUpdated: () => void;
}

export function WireframeScreenViewer({ projectId, screen, onUpdated }: WireframeScreenViewerProps) {
  const [view, setView] = useState<'rendered' | 'markdown'>('rendered');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(screen.mdContent ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beginEdit = () => {
    setDraft(screen.mdContent ?? '');
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDiscoveryWireframeScreen(projectId, screen.id, { mdContent: draft });
      onUpdated();
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const callouts = screen.callouts ?? [];
  const components = screen.components ?? [];
  const frRefs = screen.meta?.frRefs ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      {/* Main pane: rendered HTML or markdown */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button
              type="button"
              onClick={() => {
                if (editing) return;
                setView('rendered');
              }}
              disabled={editing}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                view === 'rendered' ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'
              }`}
            >
              <FileCode className="h-3 w-3 inline mr-1" />
              Rendered
            </button>
            <button
              type="button"
              onClick={() => setView('markdown')}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                view === 'markdown' ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'
              }`}
            >
              <FileText className="h-3 w-3 inline mr-1" />
              Markdown
            </button>
          </div>

          {view === 'markdown' && (
            <div>
              {!editing ? (
                <Button type="button" size="sm" variant="outline" onClick={beginEdit}>
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={saveEdit} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {view === 'rendered' ? (
          screen.htmlContent ? (
            <iframe
              title={`Wireframe — ${screen.title}`}
              sandbox="allow-same-origin"
              srcDoc={screen.htmlContent}
              className="w-full min-h-[600px] border rounded-md bg-white"
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground italic">
                No HTML rendering available — switch to Markdown view or regenerate.
              </CardContent>
            </Card>
          )
        ) : editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={28}
            className="w-full text-sm p-3 rounded-md border bg-background font-mono"
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-muted/20 rounded-md border min-h-[400px]">
            {screen.mdContent ? (
              <MarkdownRenderer content={screen.mdContent} />
            ) : (
              <span className="italic text-muted-foreground text-sm">
                No markdown source — click Edit to add.
              </span>
            )}
          </div>
        )}

        {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
      </div>

      {/* Side rail: metadata + callouts + components */}
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-1.5 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Metadata
            </div>
            <div>
              <span className="text-muted-foreground">Pattern:</span>{' '}
              <span className="font-mono">{screen.pattern ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Slug:</span>{' '}
              <span className="font-mono">{screen.slug}</span>
            </div>
            {frRefs.length > 0 && (
              <div>
                <span className="text-muted-foreground">FRs:</span>{' '}
                <span className="font-mono">{frRefs.join(', ')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Callouts ({callouts.length})
            </div>
            {callouts.length === 0 ? (
              <div className="text-xs italic text-muted-foreground">No callouts.</div>
            ) : (
              <ol className="space-y-2 text-xs">
                {callouts.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white font-bold text-[10px] shrink-0"
                      style={{ background: '#F97316' }}
                    >
                      {c.n}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div>{c.description}</div>
                      {c.mappedTo && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          → {c.mappedTo}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {components.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Components ({components.length})
              </div>
              <ul className="space-y-1.5 text-xs">
                {components.map((c, i) => (
                  <li key={i}>
                    <code className="text-[10.5px] bg-muted px-1 py-0.5 rounded">{c.file}</code>
                    {c.purpose && (
                      <div className="text-muted-foreground text-[11px] ml-2 mt-0.5">{c.purpose}</div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
