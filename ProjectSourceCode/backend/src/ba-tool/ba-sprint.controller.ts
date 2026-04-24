import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { BaSprintService } from './ba-sprint.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';

/**
 * v4.4 B1 — Sprint CRUD endpoints.
 *
 * Project-scoped:  /projects/:id/sprints       — list + create + backfill
 * Sprint-scoped:   /sprints/:id                — get / patch / delete
 */
@Controller('ba')
export class BaSprintController {
  constructor(private readonly sprints: BaSprintService) {}

  @Get('projects/:id/sprints')
  list(@Param('id') projectId: string) {
    return this.sprints.listForProject(projectId);
  }

  @Post('projects/:id/sprints')
  create(@Param('id') projectId: string, @Body() payload: CreateSprintDto) {
    return this.sprints.createSprint(projectId, payload);
  }

  /**
   * Scan legacy free-text `sprintId` values and stub out BaSprint rows for
   * any that don't yet exist. Safe to re-run.
   */
  @Post('projects/:id/sprints/backfill')
  backfill(@Param('id') projectId: string) {
    return this.sprints.backfillFromLegacyStrings(projectId);
  }

  @Get('sprints/:id')
  getOne(@Param('id') sprintId: string) {
    return this.sprints.getById(sprintId);
  }

  /** B3 — PASS/FAIL/remaining-work over time for the dashboard chart. */
  @Get('sprints/:id/burndown')
  burndown(@Param('id') sprintId: string) {
    return this.sprints.getSprintBurndown(sprintId);
  }

  @Patch('sprints/:id')
  update(@Param('id') sprintId: string, @Body() payload: UpdateSprintDto) {
    return this.sprints.updateSprint(sprintId, payload);
  }

  @Delete('sprints/:id')
  remove(@Param('id') sprintId: string) {
    return this.sprints.deleteSprint(sprintId);
  }
}
