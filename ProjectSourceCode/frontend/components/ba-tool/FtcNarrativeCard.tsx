'use client';

import {
  deleteFtcAttachment,
  ftcGapCheck,
  listFtcAttachments,
  saveFtcConfig,
  uploadFtcAttachments,
} from '@/lib/ba-api';
import { NarrativeCard } from './NarrativeCard';

interface Props {
  moduleDbId: string;
  moduleLabel: string;
  initialNarrative: string;
  initialUseAsAdditional: boolean;
  onSaved?: (narrative: string, useAsAdditional: boolean) => void;
}

/** FTC-scoped wrapper around the shared NarrativeCard. */
export function FtcNarrativeCard(props: Props) {
  return (
    <NarrativeCard
      {...props}
      title="Tester / Architect Narrative"
      description={
        <>
          Describe additional test scenarios beyond what EPICs / User Stories / SubTasks already
          cover — e.g. domain-specific edge cases, performance scenarios, security cases not
          captured by OWASP defaults, or exploratory tests for a new capability. The AI will
          compare against the canonical FTC framework and ask follow-up questions for any gaps
          before generating the test cases.
        </>
      }
      placeholder="e.g. Also test the SLA breach notification path end-to-end: trigger via backdated task, confirm audit event is written, confirm the admin banner shows within 30 seconds..."
      useAsAdditionalLabel="Use as additional context (unchecked = drive FTC from narrative only)"
      aiRefineArtifactType="FTC_NARRATIVE"
      api={{
        listAttachments: listFtcAttachments,
        uploadAttachments: uploadFtcAttachments,
        deleteAttachment: deleteFtcAttachment,
        gapCheck: ftcGapCheck,
        saveConfig: async (moduleDbId, body) => {
          await saveFtcConfig(moduleDbId, body as never);
        },
      }}
    />
  );
}
