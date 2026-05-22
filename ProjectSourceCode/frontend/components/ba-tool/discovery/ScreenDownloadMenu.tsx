'use client';

import { useState } from 'react';
import { Download, FileImage, FileCode2, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  downloadDiscoveryScreen,
  downloadDiscoverySet,
  type ScreenExportKind,
  type ScreenExportFormat,
} from '@/lib/ba-api';

interface BaseProps {
  projectId: string;
  kind: ScreenExportKind;
  /** "individual" → screen download, "bulk" → entire set download. */
  scope: 'individual' | 'bulk';
  /** screenId when scope='individual', setId when scope='bulk'. */
  targetId: string;
  /** "icon" for compact card overlay, "buttons" for the gallery toolbar. */
  variant?: 'icon' | 'buttons';
  /** Tooltip prefix for screen-readers / titles, e.g. "Download screen" / "Download all". */
  label?: string;
}

const FORMATS: { value: ScreenExportFormat; label: string; bulkLabel: string; Icon: typeof FileImage }[] = [
  { value: 'png', label: 'PNG image', bulkLabel: 'All as PNG (ZIP)', Icon: FileImage },
  { value: 'html', label: 'Standalone HTML', bulkLabel: 'All as HTML (ZIP)', Icon: FileCode2 },
  { value: 'pdf', label: 'PDF document', bulkLabel: 'Combined PDF', Icon: FileText },
];

export function ScreenDownloadMenu({
  projectId,
  kind,
  scope,
  targetId,
  variant = 'buttons',
  label,
}: BaseProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ScreenExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (format: ScreenExportFormat) => {
    setPending(format);
    setError(null);
    try {
      if (scope === 'individual') {
        await downloadDiscoveryScreen(projectId, kind, targetId, format);
      } else {
        await downloadDiscoverySet(projectId, kind, targetId, format);
      }
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setError(msg);
    } finally {
      setPending(null);
    }
  };

  if (variant === 'icon') {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen((v) => !v);
          }}
          disabled={pending !== null}
          className={cn(
            'h-7 w-7 inline-flex items-center justify-center rounded-md border border-transparent bg-background/80 backdrop-blur hover:bg-muted hover:border-border transition-colors',
            pending !== null && 'opacity-60',
          )}
          title={label ?? 'Download'}
          aria-label={label ?? 'Download'}
        >
          {pending !== null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </button>
        {open && (
          <DownloadMenuPanel
            scope={scope}
            pending={pending}
            error={error}
            onSelect={handleDownload}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        disabled={pending !== null}
      >
        {pending !== null ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : (
          <Download className="h-3 w-3 mr-1" />
        )}
        {label ?? (scope === 'bulk' ? 'Download all' : 'Download')}
      </Button>
      {open && (
        <DownloadMenuPanel
          scope={scope}
          pending={pending}
          error={error}
          onSelect={handleDownload}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

interface PanelProps {
  scope: 'individual' | 'bulk';
  pending: ScreenExportFormat | null;
  error: string | null;
  onSelect: (format: ScreenExportFormat) => void;
  onClose: () => void;
}

function DownloadMenuPanel({ scope, pending, error, onSelect, onClose }: PanelProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="absolute right-0 mt-1 z-50 w-56 rounded-md border bg-popover shadow-md p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {FORMATS.map(({ value, label, bulkLabel, Icon }) => {
          const isPending = pending === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              disabled={pending !== null}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-left',
                'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>{scope === 'bulk' ? bulkLabel : label}</span>
            </button>
          );
        })}
        {error && (
          <div className="px-2 py-1.5 text-[11px] text-destructive border-t mt-1">
            {error}
          </div>
        )}
      </div>
    </>
  );
}
