/**
 * Pluggable storage adapter for LLD-narrative attachments. Default is disk;
 * S3/GCS adapters can be dropped in behind the same interface via env.
 */
export interface AttachmentStorage {
  readonly backendName: 'disk' | 's3' | 'gcs';

  /** Persist a file and return the opaque key used to retrieve it. */
  put(scope: string, fileName: string, data: Buffer, mimeType: string): Promise<string>;

  /** Load a previously-stored file by key. */
  get(key: string): Promise<Buffer>;

  /** Delete by key. Idempotent. */
  delete(key: string): Promise<void>;
}
