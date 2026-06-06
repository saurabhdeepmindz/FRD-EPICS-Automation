import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { HldLibraryService } from './hld-library.service';

/**
 * HLD Repository routes (Sprint v11 / HD-10). Project-scoped index/similar live
 * under the HLD namespace; the org-wide browse/search lives at /ba/hld-library.
 */
@Controller('ba')
export class HldLibraryController {
  constructor(private readonly library: HldLibraryService) {}

  /** POST /ba/projects/:id/hld/:hldId/library/index — (re)index this HLD org-wide. */
  @Post('projects/:id/hld/:hldId/library/index')
  async index(@Param('hldId', ParseUUIDPipe) hldId: string) {
    const data = await this.library.indexHld(hldId);
    return { success: true, data };
  }

  /** POST /ba/projects/:id/hld/:hldId/library/similar — find similar HLD sections (excludes self). */
  @Post('projects/:id/hld/:hldId/library/similar')
  async similar(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Body() body: { query: string },
  ) {
    const data = await this.library.findSimilar(hldId, body.query);
    return { success: true, data };
  }

  /** GET /ba/hld-library — list all indexed HLDs (browse page). */
  @Get('hld-library')
  async list() {
    const data = await this.library.list();
    return { success: true, data };
  }

  /** GET /ba/hld-library/search?q= — org-wide semantic search across indexed HLDs. */
  @Get('hld-library/search')
  async search(@Query('q') q: string) {
    const data = await this.library.search(q ?? '');
    return { success: true, data };
  }
}
