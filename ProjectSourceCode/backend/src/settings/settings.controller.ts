import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import type { AppSettings } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** GET /api/settings */
  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  /** PUT /api/settings */
  @Put()
  updateSettings(@Body() body: Partial<AppSettings>) {
    return this.settingsService.updateSettings(body);
  }
}
