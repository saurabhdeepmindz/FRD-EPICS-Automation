import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as AdmZip from 'adm-zip';
import { parseProjectStructure, placeholderComment } from './utils/project-structure-parser';

export interface LldConfigPayload {
  frontendStackId?: string | null;
  backendStackId?: string | null;
  databaseId?: string | null;
  streamingId?: string | null;
  cachingId?: string | null;
  storageId?: string | null;
  cloudId?: string | null;
  architectureId?: string | null;
  cloudServices?: string | null;
  projectStructureId?: string | null;
  backendTemplateId?: string | null;
  frontendTemplateId?: string | null;
  lldTemplateId?: string | null;
  codingGuidelinesId?: string | null;
  nfrValues?: Record<string, string> | null;
  customNotes?: string | null;
  // Narrative-driven LLD (optional — null preserves the existing stack-only flow)
  narrative?: string | null;
  useAsAdditional?: boolean | null;
}

@Injectable()
export class BaLldService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const config = await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } });
    return {
      config,
      moduleStatus: mod.moduleStatus,
      lldCompletedAt: mod.lldCompletedAt,
      lldArtifactId: mod.lldArtifactId,
    };
  }

  async saveConfig(moduleDbId: string, payload: LldConfigPayload) {
    const existing = await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } });
    const data = {
      frontendStackId: payload.frontendStackId ?? null,
      backendStackId: payload.backendStackId ?? null,
      databaseId: payload.databaseId ?? null,
      streamingId: payload.streamingId ?? null,
      cachingId: payload.cachingId ?? null,
      storageId: payload.storageId ?? null,
      cloudId: payload.cloudId ?? null,
      architectureId: payload.architectureId ?? null,
      cloudServices: payload.cloudServices ?? null,
      projectStructureId: payload.projectStructureId ?? null,
      backendTemplateId: payload.backendTemplateId ?? null,
      frontendTemplateId: payload.frontendTemplateId ?? null,
      lldTemplateId: payload.lldTemplateId ?? null,
      codingGuidelinesId: payload.codingGuidelinesId ?? null,
      // Prisma's JSON column treats null via a dedicated sentinel; passing null
      // directly is a type error. Use DbNull when the caller wants to clear it.
      nfrValues: payload.nfrValues === null || payload.nfrValues === undefined
        ? Prisma.DbNull
        : (payload.nfrValues as Prisma.InputJsonValue),
      customNotes: payload.customNotes ?? null,
      // Only touch narrative fields when the caller sent them — `undefined`
      // means "no change", `null` means "clear".
      ...(payload.narrative !== undefined ? { narrative: payload.narrative } : {}),
      ...(payload.useAsAdditional !== undefined
        ? { useAsAdditional: payload.useAsAdditional ?? true }
        : {}),
    };
    if (existing) {
      return this.prisma.baLldConfig.update({ where: { moduleDbId }, data });
    }
    return this.prisma.baLldConfig.create({ data: { moduleDbId, ...data } });
  }

  async getLldArtifact(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    if (!mod.lldArtifactId) return null;
    return this.prisma.baArtifact.findUnique({
      where: { id: mod.lldArtifactId },
      include: { sections: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * List every LLD artifact for a module (newest first). Lets the UI show a
   * stack-switcher dropdown when the Architect has generated LLDs under
   * multiple stack combinations (e.g. LLD-MOD-01, LLD-MOD-01-langchain,
   * LLD-MOD-01-nestjs).
   */
  async listLldArtifactsForModule(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const artifacts = await this.prisma.baArtifact.findMany({
      where: { moduleDbId, artifactType: 'LLD' },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: { select: { id: true } },
        pseudoFiles: { select: { id: true, language: true } },
      },
    });
    // Shape for the UI: keep payload light, just counts + metadata
    return artifacts.map((a) => ({
      id: a.id,
      artifactId: a.artifactId,
      status: a.status,
      approvedAt: a.approvedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      sectionCount: a.sections.length,
      pseudoFileCount: a.pseudoFiles.length,
      languages: Array.from(new Set(a.pseudoFiles.map((f) => f.language))).sort(),
      isCurrent: mod.lldArtifactId === a.id,
    }));
  }

  async listPseudoFiles(artifactDbId: string) {
    return this.prisma.baPseudoFile.findMany({
      where: { artifactDbId },
      orderBy: { path: 'asc' },
    });
  }

  async getPseudoFile(id: string) {
    const file = await this.prisma.baPseudoFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(`Pseudo file ${id} not found`);
    return file;
  }

  async updatePseudoFile(id: string, editedContent: string) {
    const file = await this.getPseudoFile(id);
    return this.prisma.baPseudoFile.update({
      where: { id: file.id },
      data: { editedContent, isHumanModified: true },
    });
  }

  // ─── ZIP builders ─────────────────────────────────────────────────────

  /**
   * Strip the `LLD-PseudoCode/` prefix the parser adds so ZIP entries start
   * at the canonical project root (e.g. `backend/controllers/Foo.java`).
   */
  private stripPseudoPrefix(path: string): string {
    return path.replace(/^LLD-PseudoCode\//, '').replace(/^\/+/, '');
  }

  /**
   * Build a ZIP of the Project Structure declared in Section 16 (was Section 12
   * before v4.1 renumbering). Every file in the parsed tree gets a language-
   * appropriate placeholder comment. Empty directories are preserved.
   */
  async buildProjectStructureZip(artifactDbId: string): Promise<{ buffer: Buffer; filename: string }> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: artifactDbId },
      include: {
        sections: true,
        module: { select: { moduleId: true } },
      },
    });
    if (!artifact) throw new NotFoundException(`Artifact ${artifactDbId} not found`);

    const section = artifact.sections.find((s) =>
      s.sectionKey === 'project_structure' ||
      /project\s*structure/i.test(s.sectionLabel),
    );
    if (!section) {
      throw new NotFoundException('Project Structure section not found on this LLD');
    }

    const content = section.isHumanModified && section.editedContent
      ? section.editedContent
      : section.content;

    const { files, directories } = parseProjectStructure(content);
    const zip = new AdmZip();

    // Preserve empty directories
    for (const dir of directories) {
      zip.addFile(dir, Buffer.from([]));
    }
    // One placeholder file per declared file
    for (const f of files) {
      zip.addFile(f.path, Buffer.from(placeholderComment(f.path), 'utf-8'));
    }

    const fileStem = `${artifact.artifactId}-project-structure`.replace(/\s+/g, '_');
    return { buffer: zip.toBuffer(), filename: `${fileStem}.zip` };
  }

  /**
   * Build a ZIP of all pseudo-code files for an LLD, placed at their
   * declared paths (prefix `LLD-PseudoCode/` stripped). Section 16 leaves
   * that have no matching pseudo-file get a language-appropriate placeholder.
   */
  async buildPseudoFilesZip(artifactDbId: string): Promise<{ buffer: Buffer; filename: string }> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: artifactDbId },
      include: {
        sections: true,
        module: { select: { moduleId: true } },
        pseudoFiles: { orderBy: { path: 'asc' } },
      },
    });
    if (!artifact) throw new NotFoundException(`Artifact ${artifactDbId} not found`);

    const zip = new AdmZip();
    const writtenPaths = new Set<string>();

    // First, drop every pseudo-file at its declared path
    for (const f of artifact.pseudoFiles) {
      const path = this.stripPseudoPrefix(f.path);
      const content = f.isHumanModified && f.editedContent ? f.editedContent : f.aiContent;
      zip.addFile(path, Buffer.from(content, 'utf-8'));
      writtenPaths.add(path);
    }

    // Then fill in any Section 16 leaves that don't have a pseudo-file with
    // a placeholder. This is the "merged" zip the Architect asked for.
    const projStructSection = artifact.sections.find((s) =>
      s.sectionKey === 'project_structure' ||
      /project\s*structure/i.test(s.sectionLabel),
    );
    if (projStructSection) {
      const content = projStructSection.isHumanModified && projStructSection.editedContent
        ? projStructSection.editedContent
        : projStructSection.content;
      const { files, directories } = parseProjectStructure(content);
      for (const dir of directories) {
        // Only add the directory entry if nothing inside it was already added
        // (adm-zip auto-creates parents when you addFile).
        if (!Array.from(writtenPaths).some((p) => p.startsWith(dir))) {
          zip.addFile(dir, Buffer.from([]));
        }
      }
      for (const f of files) {
        if (writtenPaths.has(f.path)) continue;
        // Also check basename collisions (pseudo-files live under backend/*
        // sub-dirs that may not exactly match the Section 16 parent path)
        const alreadyWritten = Array.from(writtenPaths).some(
          (p) => p.endsWith(`/${f.path.split('/').pop()!}`) || p === f.path,
        );
        if (alreadyWritten) continue;
        zip.addFile(f.path, Buffer.from(placeholderComment(f.path), 'utf-8'));
        writtenPaths.add(f.path);
      }
    }

    const fileStem = `${artifact.artifactId}-pseudo-files`.replace(/\s+/g, '_');
    return { buffer: zip.toBuffer(), filename: `${fileStem}.zip` };
  }

  /**
   * Return the raw content + filename for a single pseudo-file download.
   */
  async getPseudoFileDownload(id: string): Promise<{ content: string; filename: string; language: string }> {
    const f = await this.getPseudoFile(id);
    const content = f.isHumanModified && f.editedContent ? f.editedContent : f.aiContent;
    const filename = this.stripPseudoPrefix(f.path).split('/').pop() ?? 'file.txt';
    return { content, filename, language: f.language };
  }
}
