import { Injectable } from '@nestjs/common';
import { BaNarrativeService, type NarrativeGap, type UploadedFile } from './ba-narrative.service';

/**
 * FTC binding of the shared scope-agnostic narrative service. FTC-specific
 * `extraContext` (testing framework, OWASP preferences, etc.) is layered on
 * top of the common narrative+attachments flow.
 */
@Injectable()
export class BaFtcNarrativeService {
  constructor(private readonly base: BaNarrativeService) {}

  listAttachments(moduleDbId: string) {
    return this.base.listAttachments(moduleDbId, 'FTC');
  }

  uploadAttachments(moduleDbId: string, files: UploadedFile[]) {
    return this.base.uploadAttachments(moduleDbId, 'FTC', files);
  }

  deleteAttachment(moduleDbId: string, attachmentId: string) {
    return this.base.deleteAttachment(moduleDbId, 'FTC', attachmentId);
  }

  gapCheck(moduleDbId: string, extraContext: Record<string, unknown> = {}): Promise<{ gaps: NarrativeGap[]; model: string }> {
    return this.base.gapCheck(moduleDbId, 'FTC', extraContext);
  }

  buildNarrativeContextBlock(moduleDbId: string) {
    return this.base.buildNarrativeContextBlock(moduleDbId, 'FTC');
  }
}

export type { NarrativeGap as FtcGap, UploadedFile } from './ba-narrative.service';
