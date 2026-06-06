import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { HldCopilotService } from './hld-copilot.service';

/**
 * HLD Architect Copilot routes (Sprint v10 / Track C). Base path shares the HLD
 * namespace; routes are additive (no existing route changed).
 */
@Controller('ba/projects/:id/hld')
export class HldCopilotController {
  constructor(private readonly copilot: HldCopilotService) {}

  /** GET .../hld/copilot/providers — which chat models are available (key-gated). */
  @Get('copilot/providers')
  async providers() {
    const data = await this.copilot.providers();
    return { success: true, data };
  }

  /** GET .../hld/copilot/templates — Architecture console (builtin + library). */
  @Get('copilot/templates')
  async templates(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.copilot.listTemplates(id);
    return { success: true, data };
  }

  /** POST .../hld/:hldId/save-as-template — HD-09: save this HLD (whole/section) as a reusable template. */
  @Post(':hldId/save-as-template')
  async saveAsTemplate(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Body() body: { name?: string; scope?: 'GLOBAL' | 'PROJECT'; sectionKey?: string | null },
  ) {
    const data = await this.copilot.saveAsTemplate(hldId, {
      name: body.name,
      scope: body.scope,
      sectionKey: body.sectionKey ?? null,
    });
    return { success: true, data };
  }

  /** GET .../hld/:hldId/copilot/thread?section=KEY — full conversation for a section. */
  @Get(':hldId/copilot/thread')
  async thread(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Query('section') section: string,
  ) {
    const data = await this.copilot.listThread(hldId, section);
    return { success: true, data };
  }

  /** GET .../hld/:hldId/copilot/insights?section=KEY — saved insights for a section. */
  @Get(':hldId/copilot/insights')
  async insights(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Query('section') section: string,
  ) {
    const data = await this.copilot.listInsights(hldId, section);
    return { success: true, data };
  }

  /** POST .../hld/:hldId/copilot/chat — ask the copilot (persists both turns). */
  @Post(':hldId/copilot/chat')
  async chat(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Body() body: { sectionKey: string; provider?: string; message: string; template?: string | null },
  ) {
    const data = await this.copilot.chat(hldId, body.sectionKey, {
      provider: body.provider,
      message: body.message,
      template: body.template ?? null,
    });
    return { success: true, data };
  }

  /** POST .../hld/:hldId/copilot/save-insight — flag/unflag a message as saved. */
  @Post(':hldId/copilot/save-insight')
  async saveInsight(@Body() body: { messageId: string; saved: boolean }) {
    const data = await this.copilot.setInsight(body.messageId, body.saved);
    return { success: true, data };
  }

  /** POST .../hld/:hldId/copilot/section/:sectionKey/merge — synthesize a draft (no write). */
  @Post(':hldId/copilot/section/:sectionKey/merge')
  async merge(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Param('sectionKey') sectionKey: string,
    @Body() body: { provider?: string },
  ) {
    const data = await this.copilot.merge(hldId, sectionKey, body.provider);
    return { success: true, data };
  }
}
