import { Module } from '@nestjs/common';
import { DiskAttachmentStorage } from './disk-storage';

/**
 * Attachment storage module. Defaults to disk; swapping to S3/GCS is a
 * one-line factory change below driven by LLD_ATTACHMENT_STORAGE env.
 */
export const ATTACHMENT_STORAGE = 'ATTACHMENT_STORAGE';

@Module({
  providers: [
    {
      provide: ATTACHMENT_STORAGE,
      useFactory: () => {
        const backend = (process.env.LLD_ATTACHMENT_STORAGE ?? 'disk').toLowerCase();
        switch (backend) {
          case 'disk':
            return new DiskAttachmentStorage();
          // case 's3': return new S3AttachmentStorage();   // future
          // case 'gcs': return new GcsAttachmentStorage(); // future
          default:
            // Unknown backends fall back to disk so the app still boots.
            return new DiskAttachmentStorage();
        }
      },
    },
  ],
  exports: [ATTACHMENT_STORAGE],
})
export class AttachmentStorageModule {}
