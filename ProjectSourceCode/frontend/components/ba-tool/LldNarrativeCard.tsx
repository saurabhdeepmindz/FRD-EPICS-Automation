'use client';

import {
  deleteLldAttachment,
  listLldAttachments,
  lldGapCheck,
  saveLldConfig,
  uploadLldAttachments,
} from '@/lib/ba-api';
import { NarrativeCard } from './NarrativeCard';

interface Props {
  moduleDbId: string;
  moduleLabel: string;
  initialNarrative: string;
  initialUseAsAdditional: boolean;
  onSaved?: (narrative: string, useAsAdditional: boolean) => void;
}

/** LLD-scoped wrapper around the shared NarrativeCard. */
export function LldNarrativeCard(props: Props) {
  return (
    <NarrativeCard
      {...props}
      title="Architect Narrative"
      description={
        <>
          Describe additional LLD requirements that go beyond the default framework — e.g. custom
          integrations, specific security constraints, performance targets, or capabilities missing
          from the standard 19-section template. The AI will compare against the framework and ask
          follow-up questions for any gaps before generating the LLD.
        </>
      }
      placeholder="e.g. This module also needs a Kafka-based event bus for audit events, plus rate-limit enforcement at 100 req/sec per tenant..."
      useAsAdditionalLabel="Use as additional context (unchecked = drive LLD from narrative only)"
      aiRefineArtifactType="LLD_NARRATIVE"
      api={{
        listAttachments: listLldAttachments,
        uploadAttachments: uploadLldAttachments,
        deleteAttachment: deleteLldAttachment,
        gapCheck: lldGapCheck,
        saveConfig: async (moduleDbId, body) => {
          // LLD config schema accepts narrative + useAsAdditional among many fields.
          await saveLldConfig(moduleDbId, body as never);
        },
      }}
    />
  );
}
