import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { map, type Observable } from 'rxjs';
import { WireframeCopilotService, type WireframeChatDto } from './wireframe-copilot.service';
import { WireframeChangeService, type StagedChangeItem, type ChangeBatchMeta } from './wireframe-change.service';
import { WireframeChangeEventsService, type WfChangeEvent } from './wireframe-change-events.service';

/**
 * v12 · Track WC-09 — Wireframe Copilot REST surface (under the wireframes namespace).
 */
@Controller('ba/projects/:id')
export class WireframeCopilotController {
  constructor(
    private readonly copilot: WireframeCopilotService,
    private readonly changes: WireframeChangeService,
    private readonly events: WireframeChangeEventsService,
  ) {}

  // ── Copilot chat + feedback ingestion ───────────────────────────────────────
  @Post('wireframes/copilot/chat')
  async chat(@Param('id', ParseUUIDPipe) id: string, @Body() body: WireframeChatDto) {
    const data = await this.copilot.chat(id, body);
    return { success: true, data };
  }

  @Post('wireframes/copilot/feedback')
  @UseInterceptors(FileInterceptor('file'))
  async ingestFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rawText?: string; uploadedBy?: string; source?: string; targetKind?: 'LOFI' | 'HIFI' },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.copilot.ingestFeedback(id, body, file);
    return { success: true, data };
  }

  // ── Change register (static routes first, then :cid) ─────────────────────────
  @Sse('wireframes/changes/stream')
  stream(@Param('id', ParseUUIDPipe) id: string): Observable<{ data: WfChangeEvent }> {
    return this.events.stream(id).pipe(map((e) => ({ data: e })));
  }

  @Get('wireframes/changes/export')
  async exportRegister(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.changes.exportRegister(id);
    return { success: true, data };
  }

  @Get('wireframes/changes')
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
  ) {
    const data = await this.changes.list(id, { status, source });
    return { success: true, data };
  }

  @Get('wireframes/changes/:cid')
  async getChange(@Param('id', ParseUUIDPipe) _id: string, @Param('cid', ParseUUIDPipe) cid: string) {
    const data = await this.changes.get(cid);
    return { success: true, data };
  }

  @Post('wireframes/changes')
  async createChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { items: StagedChangeItem[] } & ChangeBatchMeta,
  ) {
    const { items, ...meta } = body;
    const data = await this.changes.createChanges(id, items ?? [], meta);
    return { success: true, data };
  }

  @Post('wireframes/changes/run-all')
  async runAll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { ids?: string[]; stopOnFailure?: boolean },
  ) {
    const data = await this.changes.runAll(id, body.ids, body.stopOnFailure ?? false);
    return { success: true, data };
  }

  @Post('wireframes/changes/:cid/apply')
  async apply(@Param('id', ParseUUIDPipe) _id: string, @Param('cid', ParseUUIDPipe) cid: string) {
    const data = await this.changes.apply(cid);
    return { success: true, data };
  }

  @Post('wireframes/changes/:cid/accept')
  async accept(@Param('id', ParseUUIDPipe) _id: string, @Param('cid', ParseUUIDPipe) cid: string) {
    const data = await this.changes.accept(cid);
    return { success: true, data };
  }

  @Post('wireframes/changes/:cid/revert')
  async revert(@Param('id', ParseUUIDPipe) _id: string, @Param('cid', ParseUUIDPipe) cid: string) {
    const data = await this.changes.revert(cid);
    return { success: true, data };
  }

  @Post('wireframes/changes/:cid/comment')
  async comment(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('cid', ParseUUIDPipe) cid: string,
    @Body() body: { actor?: string; message: string },
  ) {
    await this.changes.addComment(cid, body.actor ?? 'user', body.message);
    return { success: true, data: { ok: true } };
  }

  @Post('wireframes/changes/:cid/reopen')
  async reopen(@Param('id', ParseUUIDPipe) _id: string, @Param('cid', ParseUUIDPipe) cid: string) {
    const data = await this.changes.reopen(cid);
    return { success: true, data };
  }
}
