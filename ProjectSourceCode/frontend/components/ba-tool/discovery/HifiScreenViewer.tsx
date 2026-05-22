'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Edit3, Save, X, FileCode, AlertTriangle, CheckCircle2, ExternalLink, MousePointerClick } from 'lucide-react';
import {
  updateDiscoveryHifiScreen,
  type BaHifiScreen,
} from '@/lib/ba-api';

interface HifiScreenViewerProps {
  projectId: string;
  screen: BaHifiScreen;
  ctaColor: string;
  onUpdated: () => void;
  /**
   * Sibling screens in the same hi-fi set, sorted by sequenceNum. Optional —
   * only required for the click-through feature. When omitted, click-through
   * is unavailable but the rest of the viewer behaves identically.
   */
  siblings?: BaHifiScreen[];
}

export function HifiScreenViewer({ projectId, screen, ctaColor, onUpdated, siblings }: HifiScreenViewerProps) {
  const router = useRouter();
  const [view, setView] = useState<'rendered' | 'html'>('rendered');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(screen.htmlContent ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Iframe paint tracking — covers the gap between iframe attach and first paint.
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeSlow, setIframeSlow] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // ─── Click-through feature (opt-in) ────────────────────────────────────
  // OFF by default → identical to the existing render. When ON, an isolated
  // <script> is appended to the iframe HTML that intercepts button/link
  // clicks and postMessages the parent. The parent listens and routes to the
  // adjacent sibling screen. Sandbox switches to `allow-scripts` (no
  // `allow-same-origin`) so the iframe is fully isolated.
  const [clickThrough, setClickThrough] = useState(false);
  const [lastNavLabel, setLastNavLabel] = useState<string | null>(null);
  const canClickThrough = (siblings?.length ?? 0) > 1 && !editing;

  // Reset paint state when the htmlContent or active screen changes.
  useEffect(() => {
    setIframeLoaded(false);
    setIframeSlow(false);
    setLastNavLabel(null);
    if (!screen.htmlContent) return;
    // If the iframe doesn't fire onLoad within 4 s, surface a hint with an
    // alternative open-in-new-tab path so the user isn't stuck looking at a
    // perceived spinner.
    const slow = setTimeout(() => setIframeSlow(true), 4_000);
    return () => clearTimeout(slow);
  }, [screen.id, screen.htmlContent]);

  // Auto-disable click-through when the user starts editing — they shouldn't
  // accidentally navigate away mid-edit.
  useEffect(() => {
    if (editing) setClickThrough(false);
  }, [editing]);

  // postMessage listener: route to the adjacent sibling screen. Only wired
  // when click-through is enabled — otherwise no-op.
  useEffect(() => {
    if (!clickThrough || !siblings || siblings.length < 2) return;
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; direction?: string; label?: string } | null;
      if (!data || data.type !== 'hifi-click-through') return;
      const idx = siblings.findIndex((s) => s.id === screen.id);
      if (idx < 0) return;
      const direction = data.direction === 'prev' ? 'prev' : 'next';
      const nextIdx =
        direction === 'next'
          ? (idx + 1) % siblings.length
          : (idx - 1 + siblings.length) % siblings.length;
      if (nextIdx === idx) return;
      setLastNavLabel(`${direction === 'next' ? '→' : '←'} ${data.label || 'click'} → screen #${String(siblings[nextIdx].sequenceNum).padStart(2, '0')}`);
      router.push(`/ba-tool/project/${projectId}/discovery/hifi/${siblings[nextIdx].id}`);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [clickThrough, siblings, screen.id, projectId, router]);

  /**
   * The HTML we render inside the iframe. When click-through is OFF we use the
   * raw htmlContent verbatim (existing behavior preserved). When ON, we append
   * a small idempotent script that intercepts button/link clicks and posts a
   * message to the parent. We also outline interactive elements visually so
   * the user knows the iframe is now "active".
   */
  const iframeSrcDoc = useMemo(() => {
    const html = screen.htmlContent ?? '';
    if (!clickThrough || !html) return html;
    const cta = ctaColor || '#F97316';
    const injected = `
<style id="__hifi_click_through_outline">button, a, [role="button"], input[type="button"], input[type="submit"] { cursor: pointer !important; outline: 2px dashed ${cta}66 !important; outline-offset: 2px !important; }</style>
<script>
(function () {
  if (window.__hifi_click_through_installed__) return;
  window.__hifi_click_through_installed__ = true;
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document.body && el.nodeType === 1) {
      var tag = (el.tagName || '').toUpperCase();
      var role = el.getAttribute && el.getAttribute('role');
      var isButton = tag === 'BUTTON' || tag === 'A' || role === 'button' || role === 'link' ||
        (tag === 'INPUT' && /^(button|submit)$/i.test(el.getAttribute('type') || ''));
      if (isButton) {
        e.preventDefault();
        e.stopPropagation();
        var label = (el.textContent || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 80);
        var lower = label.toLowerCase();
        var direction = /\\b(back|previous|prev|cancel|reject|close)\\b/.test(lower) ? 'prev' : 'next';
        try {
          parent.postMessage({ type: 'hifi-click-through', direction: direction, label: label }, '*');
        } catch (err) { /* sandboxed; swallow */ }
        return;
      }
      el = el.parentNode;
    }
  }, true);
})();
</script>`;
    if (html.includes('</body>')) return html.replace('</body>', `${injected}</body>`);
    return html + injected;
  }, [clickThrough, screen.htmlContent, ctaColor]);

  const openInNewTab = () => {
    if (!screen.htmlContent) return;
    const blob = new Blob([screen.htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    // Revoke after the new tab has had a chance to fetch the blob.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const beginEdit = () => {
    setDraft(screen.htmlContent ?? '');
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
      await updateDiscoveryHifiScreen(projectId, screen.id, { htmlContent: draft });
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
  const parity = screen.parityStatus;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
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
                onClick={() => setView('html')}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  view === 'html' ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'
                }`}
              >
                HTML source
              </button>
            </div>

            {/* Click-through toggle — only available in Rendered view, with multi-screen sets */}
            {view === 'rendered' && (
              <button
                type="button"
                onClick={() => setClickThrough((v) => !v)}
                disabled={!canClickThrough}
                title={
                  !canClickThrough
                    ? siblings && siblings.length < 2
                      ? 'Need at least 2 hi-fi screens for click-through demo'
                      : 'Disable edit mode first'
                    : clickThrough
                      ? 'Click-through ON — buttons in the mockup navigate to next/prev screen'
                      : 'Turn on click-through — clicking buttons in the mockup will demo-navigate to next/prev screen'
                }
                className={`text-xs px-2.5 py-1 rounded-md border inline-flex items-center transition-colors ${
                  clickThrough
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-semibold'
                    : 'border-input hover:bg-muted text-muted-foreground'
                } ${!canClickThrough ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <MousePointerClick className="h-3 w-3 mr-1" />
                Click-through {clickThrough ? 'ON' : 'OFF'}
              </button>
            )}
          </div>

          {view === 'html' && (
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
            <div className="relative">
              <iframe
                ref={iframeRef}
                title={`Hi-fi — ${screen.title}`}
                sandbox={clickThrough ? 'allow-scripts' : 'allow-same-origin'}
                srcDoc={iframeSrcDoc}
                onLoad={() => setIframeLoaded(true)}
                className="w-full min-h-[600px] border rounded-md bg-white"
              />
              {!iframeLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-md gap-2 pointer-events-none">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">
                    Rendering hi-fi mockup ({(screen.htmlContent.length / 1024).toFixed(1)} KB)…
                  </div>
                  {iframeSlow && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 italic mt-1 max-w-md text-center pointer-events-auto">
                      Render is taking longer than expected. The iframe may be blocked by your browser
                      sandbox; try the alternatives below or switch to the HTML source tab.
                    </div>
                  )}
                </div>
              )}
              {iframeSlow && !iframeLoaded && (
                <div className="absolute top-2 right-2 flex gap-2 pointer-events-auto">
                  <Button type="button" size="sm" variant="outline" onClick={openInNewTab}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open in new tab
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setView('html')}>
                    <FileCode className="h-3 w-3 mr-1" />
                    View source
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground italic">
                No HTML content — switch to source view or regenerate the set.
              </CardContent>
            </Card>
          )
        ) : editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={28}
            className="w-full text-xs p-3 rounded-md border bg-background font-mono"
          />
        ) : (
          <pre className="text-[11px] p-3 bg-muted/20 rounded-md border overflow-auto max-h-[700px] font-mono whitespace-pre-wrap">
            {screen.htmlContent || '(empty)'}
          </pre>
        )}

        {/* Click-through status strip — only when feature is active in Rendered view */}
        {view === 'rendered' && clickThrough && screen.htmlContent && (
          <div className="mt-2 px-3 py-2 rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 text-[11px] text-orange-700 dark:text-orange-400 flex items-center justify-between gap-2 flex-wrap">
            <span>
              <MousePointerClick className="inline h-3 w-3 mr-1" />
              Click-through demo mode — clicks on dashed-outlined buttons inside the mockup will navigate
              to the next screen (or previous, for back/cancel/reject buttons).
            </span>
            {lastNavLabel && <span className="font-mono text-[10px] opacity-80">last: {lastNavLabel}</span>}
          </div>
        )}

        {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
      </div>

      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-1.5 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Metadata
            </div>
            <div>
              <span className="text-muted-foreground">Slug:</span>{' '}
              <span className="font-mono">{screen.slug}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sequence:</span>{' '}
              <span className="font-mono">#{String(screen.sequenceNum).padStart(2, '0')}</span>
            </div>
          </CardContent>
        </Card>

        {parity && (
          <Card
            className={
              parity.ok
                ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
                : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
            }
          >
            <CardContent className="p-3 text-xs">
              <div className="flex items-center gap-1.5 mb-1.5">
                {parity.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                )}
                <span className="font-semibold">
                  Parity {parity.ok ? '✓' : '⚠'}
                </span>
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div>
                  Lo-fi: <span className="font-mono">[{parity.lofiCallouts.join(', ')}]</span>
                </div>
                <div>
                  Hi-fi: <span className="font-mono">[{parity.hifiCallouts.join(', ')}]</span>
                </div>
                {parity.missing.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400">
                    missing: <span className="font-mono">{parity.missing.join(', ')}</span>
                  </div>
                )}
                {parity.invalidExtras.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400">
                    invalid: <span className="font-mono">{parity.invalidExtras.join(', ')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                      style={{ background: ctaColor }}
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
      </div>
    </div>
  );
}
