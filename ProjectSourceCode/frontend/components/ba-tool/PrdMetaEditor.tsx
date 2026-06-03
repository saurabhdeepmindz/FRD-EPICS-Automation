'use client';

/**
 * PrdMetaEditor (Sprint v7 · Track W · Task 12).
 * Small modal to edit PRD-level metadata: PRD Code, Client Name, Submitted By.
 */

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateProjectPrdMeta, type ProjectPrd } from '@/lib/pipeline-api';

interface PrdMetaEditorProps {
  projectId: string;
  prd: ProjectPrd;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function PrdMetaEditor({ projectId, prd, onClose, onSaved }: PrdMetaEditorProps) {
  const [prdCode, setPrdCode] = useState(prd.prdCode ?? '');
  const [clientName, setClientName] = useState(prd.clientName ?? '');
  const [submittedBy, setSubmittedBy] = useState(prd.submittedBy ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProjectPrdMeta(projectId, prd.id, { prdCode, clientName, submittedBy });
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-800">PRD details</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {field('PRD Code', prdCode, setPrdCode, 'e.g., PRD03-06-2026')}
          {field('Client Name', clientName, setClientName, 'e.g., ADVANI Luggage')}
          {field('Submitted By', submittedBy, setSubmittedBy, 'e.g., Saurabh')}
        </div>
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
