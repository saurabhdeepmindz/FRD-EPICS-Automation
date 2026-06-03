'use client';

/**
 * PrdGuidedEditor (Sprint v7 · Track X · Task 9).
 * The guided single-section authoring shell: Stepper + Sidebar + focused section
 * editor + Previous / Save & Continue / Next footer. Reuses the v6 per-field
 * editors (PrdSectionEditor / FrdEditor) as the form body.
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PrdStepper } from './PrdStepper';
import { PrdSidebar } from './PrdSidebar';
import { PrdSectionEditor } from './PrdSectionEditor';
import { FrdEditor } from './FrdEditor';
import { PRD_SECTION_NAMES, type ProjectPrd } from '@/lib/pipeline-api';

interface PrdGuidedEditorProps {
  projectId: string;
  prd: ProjectPrd;
  /** Reload the PRD after a save (refreshes statuses). */
  onChanged: () => void | Promise<void>;
  /** Section to open first (e.g. when jumping from review "Edit"). */
  initialKey?: string;
}

export function PrdGuidedEditor({ projectId, prd, onChanged, initialKey }: PrdGuidedEditorProps) {
  const [activeKey, setActiveKey] = useState(initialKey ?? '1');
  const isFrd = activeKey === '6';
  const statuses = prd.sectionStatuses ?? {};
  const num = Number(activeKey);

  const go = (next: number) => setActiveKey(String(Math.min(22, Math.max(1, next))));

  const editorKey = `${prd.version}-${activeKey}`;

  return (
    <Card className="overflow-hidden">
      <PrdStepper activeKey={activeKey} statuses={statuses} onSelect={setActiveKey} />
      <div className="flex min-h-[28rem]">
        <PrdSidebar
          activeKey={activeKey}
          statuses={statuses}
          sections={prd.sections}
          onSelect={setActiveKey}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <CardContent className="flex-1 pt-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              <span className="font-mono text-gray-400 mr-2">Section {activeKey}</span>
              {PRD_SECTION_NAMES[activeKey] ?? `Section ${activeKey}`}
            </h2>
            {isFrd ? (
              <FrdEditor
                key={editorKey}
                projectId={projectId}
                prdId={prd.id}
                body={prd.sections['6'] ?? {}}
                onSaved={async () => {
                  await onChanged();
                  go(num + 1);
                }}
                onCancel={onChanged}
              />
            ) : (
              <PrdSectionEditor
                key={editorKey}
                projectId={projectId}
                prdId={prd.id}
                sectionKey={activeKey}
                body={prd.sections[activeKey] ?? {}}
                onSaved={async () => {
                  await onChanged();
                  go(num + 1);
                }}
                onCancel={onChanged}
              />
            )}
          </CardContent>
          {/* Footer nav — Previous / Next (the editor's own Save acts as Save & Continue) */}
          <div className="flex items-center justify-between border-t px-4 py-3 bg-gray-50/60">
            <Button variant="outline" size="sm" onClick={() => go(num - 1)} disabled={num <= 1}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <span className="text-xs text-gray-400">Section {activeKey} of 22</span>
            <Button variant="outline" size="sm" onClick={() => go(num + 1)} disabled={num >= 22}>
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
