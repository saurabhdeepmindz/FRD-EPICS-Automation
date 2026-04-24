'use client';

import { useState } from 'react';
import type { BaScreenLite } from '@/lib/ba-api';
import { cn } from '@/lib/utils';
import { X, Monitor } from 'lucide-react';

interface ScreensGalleryProps {
  screens: BaScreenLite[];
  /** Optionally filter to only these screen IDs (e.g. SCR-01, SCR-03) */
  highlightIds?: string[];
  /** Compact: smaller thumbnails */
  compact?: boolean;
}

/**
 * Reusable image gallery for BA screens. Used in EPIC / User Story editor
 * views and in the document preview. Click a thumbnail to open a lightbox.
 */
export function ScreensGallery({ screens, highlightIds, compact = false }: ScreensGalleryProps) {
  const [active, setActive] = useState<BaScreenLite | null>(null);

  if (!screens || screens.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No screens uploaded for this module.</p>
    );
  }

  const highlightSet = highlightIds && highlightIds.length > 0 ? new Set(highlightIds) : null;

  return (
    <>
      <div className={cn(
        'grid gap-3',
        compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
      )}>
        {screens.map((s) => {
          const isHighlighted = highlightSet ? highlightSet.has(s.screenId) : true;
          return (
            <button
              key={s.id}
              type="button"
              id={`screen-thumb-${s.screenId}`}
              onClick={() => setActive(s)}
              className={cn(
                'text-left rounded-md border overflow-hidden bg-card hover:shadow-md transition scroll-mt-20',
                isHighlighted ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border opacity-60 hover:opacity-100',
              )}
              title={`Click to view ${s.screenId} — ${s.screenTitle}`}
            >
              <div className={cn('w-full bg-muted/40', compact ? 'h-24' : 'h-40')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.fileData}
                  alt={s.screenTitle}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="px-2 py-1.5 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{s.screenId}</span>
                  {s.screenType && <span className="text-[9px] text-muted-foreground">{s.screenType}</span>}
                </div>
                <p className="text-[11px] font-medium text-foreground truncate mt-0.5">{s.screenTitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setActive(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-full flex flex-col bg-card rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{active.screenId}</span>
                <span className="text-sm font-medium">{active.screenTitle}</span>
                {active.screenType && <span className="text-[10px] text-muted-foreground">({active.screenType})</span>}
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="p-1 rounded hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.fileData} alt={active.screenTitle} className="max-w-full max-h-[70vh] object-contain" />
            </div>
            {active.textDescription && (
              <div className="border-t border-border px-4 py-3 text-xs text-foreground bg-muted/20 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {active.textDescription}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Pull SCR-XX references from arbitrary text (e.g. "Screen Reference: SCR-01, SCR-02"). */
export function extractScreenIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\bSCR-\d+\b/g)) ids.add(m[0]);
  return Array.from(ids);
}

/**
 * Filter a set of module screens down to only those referenced anywhere in
 * the supplied content blocks (e.g. all section contents of an artifact).
 * Returns the original list if nothing references any screen — caller can
 * decide whether to render none / all in that case.
 */
export function filterReferencedScreens(
  screens: BaScreenLite[],
  contentBlocks: string[],
): { matched: BaScreenLite[]; referencedIds: string[] } {
  const referenced = new Set<string>();
  for (const block of contentBlocks) {
    for (const id of extractScreenIds(block)) referenced.add(id);
  }
  const matched = screens.filter((s) => referenced.has(s.screenId));
  return { matched, referencedIds: Array.from(referenced) };
}
