import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';

interface ExportableScreen {
  sequenceNum: number;
  slug: string;
  title: string;
  htmlContent: string | null;
}

/**
 * Track D — mirrors Discovery wireframes/mockups to disk.
 * Lo-fi screens → `ProjectArtifacts/03-Wireframes-LoFi/`
 * Hi-fi screens → `ProjectArtifacts/04-Wireframes-HiFi/`
 *
 * Fully reuses the existing Discovery `BaWireframeScreen` / `BaHifiScreen`
 * HTML — no new generation, just a disk write hook called after generate.
 */
@Injectable()
export class WireframeExportService {
  private readonly logger = new Logger(WireframeExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
  ) {}

  async exportLoFi(projectId: string, screens: ExportableScreen[]): Promise<void> {
    await this.export(projectId, 'lofi', screens);
  }

  async exportHiFi(projectId: string, screens: ExportableScreen[]): Promise<void> {
    await this.export(projectId, 'hifi', screens);
  }

  /**
   * Backfill — export the latest existing lo-fi + hi-fi set of every project to
   * disk. Idempotent. Used to mirror wireframes generated before Track D shipped.
   */
  async backfillAll(): Promise<{ lofiSets: number; hifiSets: number }> {
    let lofiSets = 0;
    let hifiSets = 0;

    const wireframeSets = await this.prisma.baWireframeSet.findMany({
      orderBy: { createdAt: 'desc' },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    const seenLofi = new Set<string>();
    for (const set of wireframeSets) {
      if (seenLofi.has(set.projectId)) continue; // latest per project only
      seenLofi.add(set.projectId);
      await this.export(set.projectId, 'lofi', set.screens);
      lofiSets++;
    }

    const hifi = await this.prisma.baHifiSet.findMany({
      orderBy: { createdAt: 'desc' },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    const seenHifi = new Set<string>();
    for (const set of hifi) {
      if (seenHifi.has(set.projectId)) continue;
      seenHifi.add(set.projectId);
      await this.export(set.projectId, 'hifi', set.screens);
      hifiSets++;
    }

    return { lofiSets, hifiSets };
  }

  private async export(
    projectId: string,
    kind: 'lofi' | 'hifi',
    screens: ExportableScreen[],
  ): Promise<void> {
    const withHtml = screens.filter((s) => s.htmlContent?.trim());
    if (!withHtml.length) return;

    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) return;

    const subfolder = kind === 'lofi' ? '03-Wireframes-LoFi' : '04-Wireframes-HiFi';
    try {
      for (const s of withHtml) {
        const fileName = `${String(s.sequenceNum).padStart(2, '0')}-${s.slug}.html`;
        await this.projectFolders.writeArtifactFile(
          project.name,
          subfolder,
          fileName,
          s.htmlContent!,
        );
      }
      await this.projectFolders.appendChangelog(project.name, {
        summary: `Exported ${withHtml.length} ${kind === 'lofi' ? 'lo-fi wireframe' : 'hi-fi mockup'} screen(s)`,
        affectedArtifacts: [`${subfolder}/`],
        source: kind === 'lofi' ? 'Lo-fi wireframes' : 'Hi-fi mockups',
        timestamp: new Date().toISOString(),
      });
      this.logger.log(
        `Exported ${withHtml.length} ${kind} screens to ${subfolder} for ${project.name}`,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Wireframe (${kind}) disk export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
