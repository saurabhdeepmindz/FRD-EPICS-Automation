import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * The ten numbered artifact subfolders under `ProjectArtifacts/`.
 * Order mirrors the pipeline stages so the folder listing reads top-to-bottom.
 */
export const ARTIFACT_SUBFOLDERS = [
  '01-CustomerInputs',
  '02-PRD-FRD',
  '02b-ScreenMap',
  '03-Wireframes-LoFi',
  '04-Wireframes-HiFi',
  '05-HLD',
  '06-EPICs',
  '07-UserStories',
  '08-SubTasks',
  '09-LLD',
  '10-RTM',
] as const;

export type ArtifactSubfolder = (typeof ARTIFACT_SUBFOLDERS)[number];

/** Resolved absolute paths for a project's on-disk layout. */
export interface ProjectPaths {
  /** `Projects/{ProjectName}/` */
  root: string;
  /** `Projects/{ProjectName}/ProjectArtifacts/` */
  artifacts: string;
  /** `Projects/{ProjectName}/ProjectSourceCode/` */
  sourceCode: string;
  /** `Projects/{ProjectName}/ProjectSourceCode/.context/` */
  context: string;
  /** `Projects/{ProjectName}/CHANGELOG.md` */
  changelog: string;
}

/**
 * Manages the on-disk folder tree for each customer project.
 *
 * Layout (root = `project.name`, human-readable — NOT the project code):
 *   Projects/{ProjectName}/
 *   ├── CHANGELOG.md            ← downstream→upstream change log
 *   ├── ProjectArtifacts/       ← 10 numbered subfolders (one per pipeline stage)
 *   └── ProjectSourceCode/
 *       └── .context/           ← context-engineering markdown for /prd + /dev
 *
 * Root location is configurable via env `PROJECTS_ROOT`; defaults to the repo's
 * top-level `Projects/` folder (two levels up from the backend cwd).
 */
@Injectable()
export class ProjectFolderService {
  private readonly logger = new Logger(ProjectFolderService.name);
  private readonly projectsRoot: string;

  constructor() {
    const configured = process.env.PROJECTS_ROOT ?? '../../Projects';
    this.projectsRoot = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  /**
   * Filesystem-safe folder name from a human project name.
   * "Tax Compass (v2)" → "Tax-Compass-v2".
   */
  sanitizeName(projectName: string): string {
    const cleaned = projectName
      .trim()
      .replace(/[^a-zA-Z0-9._ -]+/g, '') // drop unsafe chars
      .replace(/\s+/g, '-') // spaces → hyphens
      .replace(/-+/g, '-') // collapse repeats
      .replace(/^[-.]+|[-.]+$/g, '') // trim leading/trailing - .
      .slice(0, 120);
    return cleaned || 'untitled-project';
  }

  /** Resolve all absolute paths for a project without touching disk. */
  resolvePaths(projectName: string): ProjectPaths {
    const root = path.join(this.projectsRoot, this.sanitizeName(projectName));
    const artifacts = path.join(root, 'ProjectArtifacts');
    const sourceCode = path.join(root, 'ProjectSourceCode');
    return {
      root,
      artifacts,
      sourceCode,
      context: path.join(sourceCode, '.context'),
      changelog: path.join(root, 'CHANGELOG.md'),
    };
  }

  /**
   * Create the full folder tree for a project (idempotent — safe to call again).
   * Seeds an empty `CHANGELOG.md` if one does not already exist.
   */
  async ensureProjectFolders(projectName: string): Promise<ProjectPaths> {
    const paths = this.resolvePaths(projectName);

    // ProjectArtifacts/ + its 10 numbered subfolders
    await fs.mkdir(paths.artifacts, { recursive: true });
    await Promise.all(
      ARTIFACT_SUBFOLDERS.map((sub) =>
        fs.mkdir(path.join(paths.artifacts, sub), { recursive: true }),
      ),
    );

    // ProjectSourceCode/.context/
    await fs.mkdir(paths.context, { recursive: true });

    // CHANGELOG.md (only if absent — never overwrite an existing log)
    await this.ensureChangelog(projectName, paths);

    this.logger.log(`Ensured project folders for "${projectName}" at ${paths.root}`);
    return paths;
  }

  /** Create the CHANGELOG.md header if the file does not exist yet. */
  private async ensureChangelog(projectName: string, paths: ProjectPaths): Promise<void> {
    try {
      await fs.access(paths.changelog);
      return; // already exists — leave it
    } catch {
      // not found — create the header
    }
    const header =
      `# Changelog — ${projectName}\n\n` +
      `Records downstream → upstream changes (code → LLD → functional docs)\n` +
      `and any artifact regenerations. Newest entries at the top.\n\n` +
      `---\n`;
    await fs.writeFile(paths.changelog, header, 'utf8');
  }

  /**
   * Append a timestamped entry to the project's CHANGELOG.md.
   * Used by Track J (downstream→upstream sync) and artifact regenerations.
   */
  async appendChangelog(
    projectName: string,
    entry: { summary: string; affectedArtifacts?: string[]; source?: string; timestamp: string },
  ): Promise<void> {
    const paths = this.resolvePaths(projectName);
    await this.ensureProjectFolders(projectName);
    const affected =
      entry.affectedArtifacts && entry.affectedArtifacts.length
        ? `\n  - Affected: ${entry.affectedArtifacts.join(', ')}`
        : '';
    const source = entry.source ? ` _(${entry.source})_` : '';
    const block = `\n## ${entry.timestamp}${source}\n\n${entry.summary}${affected}\n`;
    // Insert directly after the `---\n` header divider so newest stays on top.
    const existing = await fs.readFile(paths.changelog, 'utf8').catch(() => '');
    const dividerIdx = existing.indexOf('---\n');
    if (dividerIdx === -1) {
      await fs.appendFile(paths.changelog, block, 'utf8');
    } else {
      const insertAt = dividerIdx + '---\n'.length;
      const next = existing.slice(0, insertAt) + block + existing.slice(insertAt);
      await fs.writeFile(paths.changelog, next, 'utf8');
    }
  }

  /**
   * Write a file into one of the ProjectArtifacts subfolders.
   * Returns the absolute path written. Used by all artifact-export tracks.
   */
  async writeArtifactFile(
    projectName: string,
    subfolder: ArtifactSubfolder,
    fileName: string,
    content: string | Buffer,
  ): Promise<string> {
    const paths = this.resolvePaths(projectName);
    const dir = path.join(paths.artifacts, subfolder);
    await fs.mkdir(dir, { recursive: true });
    const safeFile = this.sanitizeFileName(fileName);
    const full = path.join(dir, safeFile);
    await fs.writeFile(full, content);
    this.logger.debug(`Wrote artifact ${subfolder}/${safeFile} (${content.length} bytes)`);
    return full;
  }

  /**
   * Write a file into a NESTED path inside an artifact subfolder, e.g.
   * `01-CustomerInputs/AUDIO/recording.mp3`. Each path segment is sanitized.
   * Returns the absolute path written.
   */
  async writeArtifactNested(
    projectName: string,
    subfolder: ArtifactSubfolder,
    segments: string[],
    content: string | Buffer,
  ): Promise<string> {
    const paths = this.resolvePaths(projectName);
    const safeSegments = segments
      .map((s) => this.sanitizeFileName(s))
      .filter(Boolean);
    if (!safeSegments.length) throw new Error('writeArtifactNested: empty path');
    const dir = path.join(paths.artifacts, subfolder, ...safeSegments.slice(0, -1));
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, safeSegments[safeSegments.length - 1]);
    await fs.writeFile(full, content);
    this.logger.debug(`Wrote artifact ${subfolder}/${safeSegments.join('/')}`);
    return full;
  }

  /** Delete a file by absolute path (no-op if missing). Used on input delete. */
  async deleteFile(absolutePath: string): Promise<void> {
    try {
      await fs.unlink(absolutePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
    }
  }

  /**
   * Write a file into ProjectSourceCode/, creating subdirectories from the
   * relative path (e.g. "src/services/foo.ts"). Used by Track H pseudo-file placement.
   */
  async writeSourceFile(
    projectName: string,
    relativePath: string,
    content: string | Buffer,
  ): Promise<string> {
    const paths = this.resolvePaths(projectName);
    const safeRel = path
      .normalize(relativePath)
      .replace(/^([.][.](\\|\/))+/, ''); // strip path-traversal
    const full = path.join(paths.sourceCode, safeRel);
    if (!full.startsWith(paths.sourceCode)) {
      throw new Error(`Invalid source path escapes project: ${relativePath}`);
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
    return full;
  }

  /** Write a context-engineering markdown file into ProjectSourceCode/.context/. */
  async writeContextFile(
    projectName: string,
    fileName: string,
    content: string,
  ): Promise<string> {
    const paths = this.resolvePaths(projectName);
    await fs.mkdir(paths.context, { recursive: true });
    const full = path.join(paths.context, this.sanitizeFileName(fileName));
    await fs.writeFile(full, content, 'utf8');
    return full;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200);
  }
}
