import { Injectable, NotFoundException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaProjectStatus, BaModuleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { CreateBaProjectDto } from './dto/create-project.dto';
import { CreateBaModuleDto } from './dto/create-module.dto';
import { UpdateBaScreenDto } from './dto/update-screen.dto';
import { CreateBaFlowDto } from './dto/create-flow.dto';

@Injectable()
export class BaToolService {
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  // ─── Projects ──────────────────────────────────────────────────────────

  async createProject(dto: CreateBaProjectDto) {
    return this.prisma.baProject.create({
      data: {
        name: dto.name,
        projectCode: dto.projectCode,
        description: dto.description,
        status: BaProjectStatus.ACTIVE,
      },
      include: { modules: true },
    });
  }

  async listProjects() {
    return this.prisma.baProject.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        modules: {
          select: { id: true, moduleId: true, moduleName: true, moduleStatus: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async getProject(id: string) {
    const project = await this.prisma.baProject.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { createdAt: 'asc' },
          include: {
            screens: { select: { id: true, screenId: true, screenTitle: true, screenType: true, displayOrder: true }, orderBy: { displayOrder: 'asc' } },
            _count: { select: { skillExecutions: true, artifacts: true, flows: true } },
          },
        },
      },
    });
    if (!project) throw new NotFoundException(`BA Project ${id} not found`);
    return project;
  }

  async archiveProject(id: string) {
    await this.getProject(id);
    return this.prisma.baProject.update({
      where: { id },
      data: { status: BaProjectStatus.ARCHIVED },
    });
  }

  // ─── Modules ───────────────────────────────────────────────────────────

  async createModule(projectId: string, dto: CreateBaModuleDto) {
    await this.getProject(projectId);
    return this.prisma.baModule.create({
      data: {
        projectId,
        moduleId: dto.moduleId,
        moduleName: dto.moduleName,
        packageName: dto.packageName,
        moduleStatus: BaModuleStatus.DRAFT,
      },
    });
  }

  async getModule(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: {
        screens: { orderBy: { displayOrder: 'asc' } },
        flows: { orderBy: { createdAt: 'asc' } },
        skillExecutions: { orderBy: { createdAt: 'desc' } },
        artifacts: { orderBy: { createdAt: 'asc' }, include: { sections: true } },
        tbdFutureEntries: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!mod) throw new NotFoundException(`BA Module ${moduleDbId} not found`);
    return mod;
  }

  // ─── Screens ───────────────────────────────────────────────────────────

  async uploadScreen(
    moduleDbId: string,
    file: Express.Multer.File,
    screenTitle: string,
    screenType?: string,
  ) {
    await this.getModule(moduleDbId);

    // Auto-assign next screen ID
    const existingCount = await this.prisma.baScreen.count({ where: { moduleDbId } });
    const screenId = `SCR-${String(existingCount + 1).padStart(2, '0')}`;

    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    return this.prisma.baScreen.create({
      data: {
        moduleDbId,
        screenId,
        screenTitle: screenTitle || file.originalname,
        screenType: screenType || null,
        fileData: base64,
        fileName: file.originalname,
        mimeType: file.mimetype,
        displayOrder: existingCount,
      },
    });
  }

  async uploadScreensBatch(
    moduleDbId: string,
    files: Express.Multer.File[],
  ) {
    const results = [];
    for (const file of files) {
      const screen = await this.uploadScreen(moduleDbId, file, file.originalname);
      results.push(screen);
    }
    // Update module status
    await this.prisma.baModule.update({
      where: { id: moduleDbId },
      data: { moduleStatus: BaModuleStatus.SCREENS_UPLOADED },
    });
    return results;
  }

  async updateScreen(screenDbId: string, dto: UpdateBaScreenDto) {
    const screen = await this.prisma.baScreen.findUnique({ where: { id: screenDbId } });
    if (!screen) throw new NotFoundException(`Screen ${screenDbId} not found`);
    return this.prisma.baScreen.update({
      where: { id: screenDbId },
      data: dto,
    });
  }

  async deleteScreen(screenDbId: string) {
    const screen = await this.prisma.baScreen.findUnique({ where: { id: screenDbId } });
    if (!screen) throw new NotFoundException(`Screen ${screenDbId} not found`);
    return this.prisma.baScreen.delete({ where: { id: screenDbId } });
  }

  async reorderScreens(moduleDbId: string, screenIds: string[]) {
    const updates = screenIds.map((id, index) =>
      this.prisma.baScreen.update({ where: { id }, data: { displayOrder: index } }),
    );
    await this.prisma.$transaction(updates);
    return { reordered: screenIds.length };
  }

  // ─── Click-Through Flows ───────────────────────────────────────────────

  async createFlow(moduleDbId: string, dto: CreateBaFlowDto) {
    await this.getModule(moduleDbId);
    return this.prisma.baClickThroughFlow.create({
      data: {
        moduleDbId,
        flowName: dto.flowName,
        steps: dto.steps as object,
      },
    });
  }

  async updateFlow(flowId: string, dto: CreateBaFlowDto) {
    const flow = await this.prisma.baClickThroughFlow.findUnique({ where: { id: flowId } });
    if (!flow) throw new NotFoundException(`Flow ${flowId} not found`);
    return this.prisma.baClickThroughFlow.update({
      where: { id: flowId },
      data: { flowName: dto.flowName, steps: dto.steps as object },
    });
  }

  async deleteFlow(flowId: string) {
    const flow = await this.prisma.baClickThroughFlow.findUnique({ where: { id: flowId } });
    if (!flow) throw new NotFoundException(`Flow ${flowId} not found`);
    return this.prisma.baClickThroughFlow.delete({ where: { id: flowId } });
  }

  async listFlows(moduleDbId: string) {
    return this.prisma.baClickThroughFlow.findMany({
      where: { moduleDbId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Audio Transcript ──────────────────────────────────────────────────

  async saveAudioData(screenDbId: string, audioBase64: string) {
    const screen = await this.prisma.baScreen.findUnique({ where: { id: screenDbId } });
    if (!screen) throw new NotFoundException(`Screen ${screenDbId} not found`);
    return this.prisma.baScreen.update({
      where: { id: screenDbId },
      data: { audioFileData: audioBase64 },
    });
  }

  async saveTranscript(screenDbId: string, transcript: string, reviewed: boolean) {
    const screen = await this.prisma.baScreen.findUnique({ where: { id: screenDbId } });
    if (!screen) throw new NotFoundException(`Screen ${screenDbId} not found`);
    return this.prisma.baScreen.update({
      where: { id: screenDbId },
      data: { audioTranscript: transcript, transcriptReviewed: reviewed },
    });
  }

  // ─── AI Format Transcript ─────────────────────────────────────────────

  async formatTranscript(screenDbId: string): Promise<{ formattedText: string }> {
    const screen = await this.prisma.baScreen.findUnique({ where: { id: screenDbId } });
    if (!screen) throw new NotFoundException(`Screen ${screenDbId} not found`);
    if (!screen.audioTranscript) throw new NotFoundException('No transcript to format');

    try {
      const { data } = await axios.post<{ formattedText: string }>(
        `${this.aiServiceUrl}/ba/format-transcript`,
        {
          transcript: screen.audioTranscript,
          screenTitle: screen.screenTitle,
          screenType: screen.screenType ?? '',
        },
        { timeout: 30_000 },
      );

      // Save AI-formatted version to DB
      await this.prisma.baScreen.update({
        where: { id: screenDbId },
        data: { aiFormattedTranscript: data.formattedText, aiTranscriptReviewed: false },
      });

      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        throw new HttpException(err.response.data?.detail ?? 'AI formatting failed', err.response.status);
      }
      throw new HttpException('AI service unavailable', 502);
    }
  }

  async saveAiFormattedTranscript(screenDbId: string, text: string, reviewed: boolean) {
    const screen = await this.prisma.baScreen.findUnique({ where: { id: screenDbId } });
    if (!screen) throw new NotFoundException(`Screen ${screenDbId} not found`);
    return this.prisma.baScreen.update({
      where: { id: screenDbId },
      data: { aiFormattedTranscript: text, aiTranscriptReviewed: reviewed },
    });
  }
}
