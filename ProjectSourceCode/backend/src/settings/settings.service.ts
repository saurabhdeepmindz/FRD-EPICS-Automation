import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  rateLimit: number;
  maxFileSizeMB: number;
  aiModel: string;
  aiTemperature: number;
  maxConcurrentUsers: number;
  uptimeTarget: number;
}

const DEFAULTS: AppSettings = {
  rateLimit: 20,
  maxFileSizeMB: 20,
  aiModel: 'gpt-4.5-preview',
  aiTemperature: 0.4,
  maxConcurrentUsers: 15,
  uptimeTarget: 90,
};

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  getSettings(): AppSettings {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return { ...DEFAULTS, ...JSON.parse(raw) };
      }
    } catch (err) {
      this.logger.warn('Failed to read settings file, using defaults', err);
    }
    return { ...DEFAULTS };
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const merged = { ...current, ...updates };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    this.logger.log('Settings updated: %s', JSON.stringify(updates));
    return merged;
  }
}
