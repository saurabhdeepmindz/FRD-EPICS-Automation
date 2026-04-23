import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { AttachmentStorage } from './storage.interface';

/**
 * Disk-backed attachment storage. Files live under the configured root directory;
 * keys are `<scope>/<uuid>__<sanitizedFileName>` so listings by scope remain cheap.
 */
@Injectable()
export class DiskAttachmentStorage implements AttachmentStorage {
  private readonly logger = new Logger(DiskAttachmentStorage.name);
  readonly backendName = 'disk' as const;
  private readonly root: string;

  constructor() {
    const configured = process.env.LLD_ATTACHMENT_DISK_PATH ?? 'uploads/lld-attachments';
    this.root = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  private sanitize(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  }

  async put(scope: string, fileName: string, data: Buffer, _mimeType: string): Promise<string> {
    // Sanitize each path segment of scope so sub-directories are all safe,
    // then build the key using those sanitized segments.
    const safeScope = scope
      .split('/')
      .map((seg) => seg.replace(/[^a-zA-Z0-9._-]+/g, '_'))
      .filter(Boolean)
      .join('/');
    const key = `${safeScope}/${randomUUID()}__${this.sanitize(fileName)}`;
    const fullPath = this.resolve(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    this.logger.debug(`put ${key} (${data.length} bytes)`);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
    }
  }

  private resolve(key: string): string {
    // Prevent path-traversal: reject keys that escape the root
    const normalized = path.normalize(key).replace(/^([.][.](\\|\/))+/, '');
    const full = path.resolve(this.root, normalized);
    if (!full.startsWith(this.root)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }
}
