import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PrdModule } from './prd/prd.module';
import { AiModule } from './ai/ai.module';
import { ExportModule } from './export/export.module';
import { UploadModule } from './upload/upload.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    // Load .env file and expose process.env throughout the app
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    PrdModule,
    AiModule,
    ExportModule,
    UploadModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
