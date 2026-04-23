import { Injectable } from '@nestjs/common';
import { BaNarrativeService, type NarrativeGap, type UploadedFile } from './ba-narrative.service';

/**
 * Backwards-compat wrapper. Historically the LLD workbench talked to
 * `BaLldNarrativeService` directly; the logic now lives in the scope-agnostic
 * `BaNarrativeService` (shared with FTC). This wrapper binds the LLD scope so
 * existing controllers and the orchestrator keep their call sites unchanged.
 */
@Injectable()
export class BaLldNarrativeService {
  constructor(private readonly base: BaNarrativeService) {}

  listAttachments(moduleDbId: string) {
    return this.base.listAttachments(moduleDbId, 'LLD');
  }

  uploadAttachments(moduleDbId: string, files: UploadedFile[]) {
    return this.base.uploadAttachments(moduleDbId, 'LLD', files);
  }

  deleteAttachment(moduleDbId: string, attachmentId: string) {
    return this.base.deleteAttachment(moduleDbId, 'LLD', attachmentId);
  }

  gapCheck(moduleDbId: string): Promise<{ gaps: NarrativeGap[]; model: string }> {
    return this.base.gapCheck(moduleDbId, 'LLD');
  }

  buildNarrativeContextBlock(moduleDbId: string) {
    return this.base.buildNarrativeContextBlock(moduleDbId, 'LLD');
  }
}

// Re-export the shared constants / types so existing imports keep resolving.
export { MAX_TOTAL_ATTACHMENT_BYTES } from './ba-narrative.service';
export type { NarrativeGap as LldGap, UploadedFile } from './ba-narrative.service';
