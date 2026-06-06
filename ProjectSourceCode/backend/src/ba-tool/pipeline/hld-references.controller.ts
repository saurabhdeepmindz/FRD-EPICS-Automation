import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HldReferencesService } from './hld-references.service';

/**
 * HLD Copilot References routes (Sprint v11 / Track RR). Additive; shares the HLD
 * namespace. Reference URLs are fetched server-side (SSRF-guarded); documents are
 * uploaded multipart as field `file`.
 */
@Controller('ba/projects/:id/hld')
export class HldReferencesController {
  constructor(private readonly refs: HldReferencesService) {}

  /** GET .../hld/:hldId/references — all references for this HLD. */
  @Get(':hldId/references')
  async list(@Param('hldId', ParseUUIDPipe) hldId: string) {
    const data = await this.refs.list(hldId);
    return { success: true, data };
  }

  /** POST .../hld/:hldId/references/url — add + ingest a reference URL. */
  @Post(':hldId/references/url')
  async addUrl(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Body() body: { url: string; sectionKey?: string | null; provider?: string },
  ) {
    const data = await this.refs.addUrl(hldId, {
      url: body.url,
      sectionKey: body.sectionKey ?? null,
      provider: body.provider,
    });
    return { success: true, data };
  }

  /** POST .../hld/:hldId/references/document — upload + ingest a document (field `file`). */
  @Post(':hldId/references/document')
  @UseInterceptors(FileInterceptor('file'))
  async addDocument(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { sectionKey?: string | null; provider?: string },
  ) {
    const data = await this.refs.addDocument(
      hldId,
      { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname },
      { sectionKey: body.sectionKey ?? null, provider: body.provider },
    );
    return { success: true, data };
  }

  /** PATCH .../hld/references/:refId/include — toggle include-in-context. */
  @Patch('references/:refId/include')
  async setInclude(
    @Param('refId', ParseUUIDPipe) refId: string,
    @Body() body: { include: boolean },
  ) {
    const data = await this.refs.setInclude(refId, !!body.include);
    return { success: true, data };
  }

  /** DELETE .../hld/references/:refId — remove a reference. */
  @Delete('references/:refId')
  async remove(@Param('refId', ParseUUIDPipe) refId: string) {
    const data = await this.refs.remove(refId);
    return { success: true, data };
  }
}
