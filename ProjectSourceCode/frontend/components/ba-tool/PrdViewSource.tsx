'use client';

/**
 * PrdViewSource (Sprint v7 · Track X · Task 10).
 * Modal listing the customer inputs the PRD was generated from.
 */

import { useEffect, useState } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProjectPrdSource, type PrdSourceInput } from '@/lib/pipeline-api';

interface PrdViewSourceProps {
  projectId: string;
  onClose: () => void;
}

export function PrdViewSource({ projectId, onClose }: PrdViewSourceProps) {
  const [inputs, setInputs] = useState<PrdSourceInput[] | null>(null);

  useEffect(() => {
    let active = true;
    void getProjectPrdSource(projectId)
      .then((r) => {
        if (active) setInputs(r);
      })
      .catch(() => {
        if (active) setInputs([]);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-800">Source — customer inputs used</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {inputs === null ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : inputs.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Generated from a quick note / no stored customer inputs.
            </p>
          ) : (
            inputs.map((i) => (
              <div key={i.id} className="border rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-800 truncate">{i.label}</span>
                  <span className="ml-auto text-[10px] uppercase bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                    {i.inputType}
                  </span>
                </div>
                {i.fileName && <p className="text-[11px] text-gray-400">{i.fileName} · {i.charCount} chars</p>}
                {i.textExcerpt && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-3 whitespace-pre-wrap">{i.textExcerpt}</p>
                )}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
