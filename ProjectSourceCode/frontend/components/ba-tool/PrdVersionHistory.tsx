'use client';

/**
 * PrdVersionHistory (Sprint v7 · Track W · Task 11).
 * Modal: list all PRD versions, view one read-only, and restore (clone → new version).
 */

import { useEffect, useState } from 'react';
import { X, Loader2, History, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listProjectPrdVersions,
  getProjectPrdVersion,
  restoreProjectPrdVersion,
  PRD_SECTION_NAMES,
  type PrdVersionRow,
  type ProjectPrd,
} from '@/lib/pipeline-api';
import { toStructured, fieldText } from '@/lib/structured-field';

interface PrdVersionHistoryProps {
  projectId: string;
  onClose: () => void;
  onRestored: () => void | Promise<void>;
}

function leafText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return fieldText(toStructured(v));
  if (Array.isArray(v)) return v.map(leafText).filter(Boolean).join(' · ');
  if (typeof v === 'object') {
    const f = toStructured(v);
    if (f.aiContent != null || f.editedContent != null) return fieldText(f);
    return Object.values(v as Record<string, unknown>).map(leafText).filter(Boolean).join(' — ');
  }
  return String(v);
}

export function PrdVersionHistory({ projectId, onClose, onRestored }: PrdVersionHistoryProps) {
  const [versions, setVersions] = useState<PrdVersionRow[] | null>(null);
  const [viewing, setViewing] = useState<ProjectPrd | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void listProjectPrdVersions(projectId)
      .then((v) => active && setVersions(v))
      .catch(() => active && setVersions([]));
    return () => {
      active = false;
    };
  }, [projectId]);

  const onView = async (prdId: string) => {
    setBusy(true);
    try {
      setViewing(await getProjectPrdVersion(projectId, prdId));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async (prdId: string) => {
    setBusy(true);
    try {
      await restoreProjectPrdVersion(projectId, prdId);
      await onRestored();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[82vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <History className="h-4 w-4" /> Version history
            {viewing && <span className="text-gray-400 font-normal">· viewing v{viewing.version}</span>}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {viewing ? (
            <div className="p-4 space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>← Back to list</Button>
              {Array.from({ length: 22 }, (_, i) => String(i + 1)).map((key) => {
                const body = viewing.sections[key];
                const text = body ? leafText(body) : '';
                return (
                  <div key={key} className="border-b pb-2">
                    <p className="text-xs font-semibold text-gray-700">
                      <span className="font-mono text-gray-400 mr-1">{key}.</span>
                      {PRD_SECTION_NAMES[key] ?? `Section ${key}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-3 whitespace-pre-wrap">
                      {text || <span className="text-gray-300">—</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : versions === null ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-10 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="divide-y">
              {versions.map((v, idx) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium text-gray-800">v{v.version}</span>
                  {idx === 0 && (
                    <span className="text-[10px] uppercase bg-green-100 text-green-700 rounded px-1.5 py-0.5">latest</span>
                  )}
                  <span className="text-[10px] uppercase bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{v.status}</span>
                  <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleString()}</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => onView(v.id)} disabled={busy}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    {idx !== 0 && (
                      <Button variant="outline" size="sm" onClick={() => onRestore(v.id)} disabled={busy}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-2.5 border-t text-[11px] text-gray-400">View &amp; restore only (no diff/compare).</div>
      </div>
    </div>
  );
}
