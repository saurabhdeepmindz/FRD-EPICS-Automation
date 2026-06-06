import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
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

  /** POST .../hld/:hldId/copilot/chat-stream — HD-01: SSE streaming chat (token deltas). */
  @Post(':hldId/copilot/chat-stream')
  async chatStream(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Body() body: { sectionKey: string; provider?: string; message: string; template?: string | null },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const { userMessage, threadId, payload } = await this.copilot.prepareStream(hldId, body.sectionKey, {
        provider: body.provider,
        message: body.message,
        template: body.template ?? null,
      });
      res.write(`data: ${JSON.stringify({ userMessageId: userMessage.id })}\n\n`);

      const upstream = await this.copilot.openChatStream(payload);
      let full = '';
      let model: string | null = null;

      upstream.on('data', (chunk: Buffer) => {
        const block = chunk.toString('utf8');
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') continue; // swallow upstream DONE; we send our own
          res.write(`data: ${d}\n\n`); // forward delta/model/error to the browser
          try {
            const o = JSON.parse(d);
            if (o.delta) full += o.delta;
            if (o.model) model = o.model;
          } catch {
            /* ignore non-JSON keepalives */
          }
        }
      });
      upstream.on('end', async () => {
        try {
          const asst = await this.copilot.finalizeStream(threadId, full, model);
          res.write(`data: ${JSON.stringify({ done: true, messageId: asst.id, model: asst.model })}\n\n`);
        } catch {
          res.write(`data: ${JSON.stringify({ error: 'Failed to persist the answer.' })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });
      upstream.on('error', () => {
        res.write(`data: ${JSON.stringify({ error: 'Upstream stream error.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Streaming failed';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  /** POST .../hld/:hldId/copilot/suggest-field — per-field AI Suggest for the editor. */
  @Post(':hldId/copilot/suggest-field')
  async suggestField(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Body() body: { sectionKey: string; fieldName: string; currentValue?: string; provider?: string },
  ) {
    const data = await this.copilot.suggestField(
      hldId,
      body.sectionKey,
      body.fieldName,
      body.currentValue ?? '',
      body.provider,
    );
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
