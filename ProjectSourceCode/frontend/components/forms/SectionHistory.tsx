'use client';

import { useCallback, useEffect, useState } from 'react';
import { getHistory, type AuditLogEntry } from '@/lib/api';
import { History, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionHistoryProps {
  prdId: string;
  sectionNumber: number;
}

const CHANGE_TYPE_STYLES: Record<string, string> = {
  CREATED: 'bg-green-100 text-green-800',
  MODIFIED: 'bg-blue-100 text-blue-800',
  AI_GENERATED: 'bg-purple-100 text-purple-800',
  AI_MODIFIED: 'bg-amber-100 text-amber-800',
};

export function SectionHistory({ prdId, sectionNumber }: SectionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getHistory(prdId);
      setEntries(all.filter((e) => e.sectionNumber === sectionNumber));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [prdId, sectionNumber]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((prev) => !prev)}
        title="Section change history"
        data-testid={`history-btn-${sectionNumber}`}
      >
        <History className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-[480px] max-h-[400px] overflow-hidden rounded-lg border border-border bg-card shadow-lg flex flex-col"
             data-testid={`history-panel-${sectionNumber}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
            <span className="text-sm font-semibold text-foreground">
              Change History — Section {sectionNumber}
            </span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && entries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No changes recorded for this section yet.
              </p>
            )}

            {!loading && entries.length > 0 && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Version</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((e) => {
                    const field = e.fieldKey
                      .replace(/^\d+\.\d+_/, '')
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^_/, '')
                      .trim() || e.fieldKey;
                    const typeCls = CHANGE_TYPE_STYLES[e.changeType] ?? 'bg-gray-100 text-gray-700';
                    return (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="px-3 py-1.5 font-mono">{e.version}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 font-mono max-w-[120px] truncate" title={field}>
                          {field}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeCls}`}>
                            {e.changeType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">{e.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
