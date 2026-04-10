import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { BaToolService } from './ba-tool.service';
import { CreateBaProjectDto } from './dto/create-project.dto';
import { CreateBaModuleDto } from './dto/create-module.dto';
import { UpdateBaScreenDto } from './dto/update-screen.dto';
import { CreateBaFlowDto } from './dto/create-flow.dto';

@Controller('ba')
export class BaToolController {
  constructor(private readonly baToolService: BaToolService) {}

  // ─── Projects ──────────────────────────────────────────────────────────

  /** POST /api/ba/projects — create a new BA project */
  @Post('projects')
  createProject(@Body() dto: CreateBaProjectDto) {
    return this.baToolService.createProject(dto);
  }

  /** GET /api/ba/projects — list all BA projects */
  @Get('projects')
  listProjects() {
    return this.baToolService.listProjects();
  }

  /** GET /api/ba/projects/:id — get a single BA project with modules */
  @Get('projects/:id')
  getProject(@Param('id') id: string) {
    return this.baToolService.getProject(id);
  }

  /** Post /api/ba/projects/:id/archive — archive a project */
  @Post('projects/:id/archive')
  archiveProject(@Param('id') id: string) {
    return this.baToolService.archiveProject(id);
  }

  // ─── Modules ───────────────────────────────────────────────────────────

  /** POST /api/ba/projects/:id/modules — create a module under a project */
  @Post('projects/:id/modules')
  createModule(
    @Param('id') projectId: string,
    @Body() dto: CreateBaModuleDto,
  ) {
    return this.baToolService.createModule(projectId, dto);
  }

  /** GET /api/ba/modules/:id — get a single module with all sub-resources */
  @Get('modules/:id')
  getModule(@Param('id') id: string) {
    return this.baToolService.getModule(id);
  }

  // ─── Screens ───────────────────────────────────────────────────────────

  /** POST /api/ba/modules/:id/screens — upload a single screen image */
  @Post('modules/:id/screens')
  @UseInterceptors(FileInterceptor('file'))
  async uploadScreen(
    @Param('id') moduleDbId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { screenTitle?: string; screenType?: string },
  ) {
    if (!file) throw new BadRequestException('No image file provided');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image (PNG, JPG, WEBP)');
    }
    return this.baToolService.uploadScreen(
      moduleDbId,
      file,
      body.screenTitle ?? file.originalname,
      body.screenType,
    );
  }

  /** POST /api/ba/modules/:id/screens/batch — upload multiple screen images */
  @Post('modules/:id/screens/batch')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadScreensBatch(
    @Param('id') moduleDbId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    for (const f of files) {
      if (!f.mimetype.startsWith('image/')) {
        throw new BadRequestException(`File ${f.originalname} is not an image`);
      }
    }
    return this.baToolService.uploadScreensBatch(moduleDbId, files);
  }

  /** PUT /api/ba/screens/:id — update screen metadata */
  @Put('screens/:id')
  updateScreen(
    @Param('id') screenDbId: string,
    @Body() dto: UpdateBaScreenDto,
  ) {
    return this.baToolService.updateScreen(screenDbId, dto);
  }

  /** DELETE /api/ba/screens/:id — delete a screen */
  @Delete('screens/:id')
  deleteScreen(@Param('id') screenDbId: string) {
    return this.baToolService.deleteScreen(screenDbId);
  }

  /** PUT /api/ba/modules/:id/screens/reorder — reorder screens */
  @Put('modules/:id/screens/reorder')
  reorderScreens(
    @Param('id') moduleDbId: string,
    @Body() body: { screenIds: string[] },
  ) {
    return this.baToolService.reorderScreens(moduleDbId, body.screenIds);
  }

  // ─── Click-Through Flows ───────────────────────────────────────────────

  /** POST /api/ba/modules/:id/flows — create a click-through flow */
  @Post('modules/:id/flows')
  createFlow(
    @Param('id') moduleDbId: string,
    @Body() dto: CreateBaFlowDto,
  ) {
    return this.baToolService.createFlow(moduleDbId, dto);
  }

  /** GET /api/ba/modules/:id/flows — list flows for a module */
  @Get('modules/:id/flows')
  listFlows(@Param('id') moduleDbId: string) {
    return this.baToolService.listFlows(moduleDbId);
  }

  /** PUT /api/ba/flows/:id — update a flow */
  @Put('flows/:id')
  updateFlow(
    @Param('id') flowId: string,
    @Body() dto: CreateBaFlowDto,
  ) {
    return this.baToolService.updateFlow(flowId, dto);
  }

  /** DELETE /api/ba/flows/:id — delete a flow */
  @Delete('flows/:id')
  deleteFlow(@Param('id') flowId: string) {
    return this.baToolService.deleteFlow(flowId);
  }

  // ─── Audio / Transcript ────────────────────────────────────────────────

  /** POST /api/ba/screens/:id/audio — upload audio recording for a screen */
  @Post('screens/:id/audio')
  @UseInterceptors(FileInterceptor('audio'))
  async uploadAudio(
    @Param('id') screenDbId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No audio file provided');
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.baToolService.saveAudioData(screenDbId, base64);
  }

  /** PUT /api/ba/screens/:id/transcript — save/update transcript */
  @Put('screens/:id/transcript')
  saveTranscript(
    @Param('id') screenDbId: string,
    @Body() body: { transcript: string; reviewed?: boolean },
  ) {
    return this.baToolService.saveTranscript(
      screenDbId,
      body.transcript,
      body.reviewed ?? false,
    );
  }

  // ─── AI Format Transcript ──────────────────────────────────────────────

  /** POST /api/ba/screens/:id/format-transcript — AI-format the raw transcript */
  @Post('screens/:id/format-transcript')
  formatTranscript(@Param('id') screenDbId: string) {
    return this.baToolService.formatTranscript(screenDbId);
  }

  /** PUT /api/ba/screens/:id/ai-transcript — save/update AI-formatted transcript */
  @Put('screens/:id/ai-transcript')
  saveAiTranscript(
    @Param('id') screenDbId: string,
    @Body() body: { text: string; reviewed?: boolean },
  ) {
    return this.baToolService.saveAiFormattedTranscript(
      screenDbId,
      body.text,
      body.reviewed ?? false,
    );
  }

  // ─── SubTask CRUD ──────────────────────────────────────────────────────

  /** GET /api/ba/modules/:id/subtasks — list SubTasks for a module */
  @Get('modules/:id/subtasks')
  listSubTasks(@Param('id') moduleDbId: string) {
    return this.baToolService.listSubTasks(moduleDbId);
  }

  /** GET /api/ba/subtasks/:id — get full SubTask with all sections */
  @Get('subtasks/:id')
  getSubTask(@Param('id') subtaskDbId: string) {
    return this.baToolService.getSubTask(subtaskDbId);
  }

  /** PUT /api/ba/subtasks/:id/sections/:sectionKey — edit a SubTask section */
  @Put('subtasks/:id/sections/:sectionKey')
  updateSubTaskSection(
    @Param('id') subtaskDbId: string,
    @Param('sectionKey') sectionKey: string,
    @Body() body: { editedContent: string },
  ) {
    return this.baToolService.updateSubTaskSection(subtaskDbId, sectionKey, body.editedContent);
  }

  /** POST /api/ba/subtasks/:id/approve — approve a SubTask */
  @Post('subtasks/:id/approve')
  approveSubTask(@Param('id') subtaskDbId: string) {
    return this.baToolService.approveSubTask(subtaskDbId);
  }

  // ─── Sprint Sequencing ─────────────────────────────────────────────────

  /** GET /api/ba/modules/:id/sprint-sequence — get dependency-ordered SubTask sequence */
  @Get('modules/:id/sprint-sequence')
  getSprintSequence(@Param('id') moduleDbId: string) {
    return this.baToolService.getSprintSequence(moduleDbId);
  }
}
