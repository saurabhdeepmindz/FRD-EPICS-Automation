import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { PdfService } from './pdf.service';
import { PrdModule } from '../prd/prd.module';

@Module({
  imports: [PrdModule],
  controllers: [ExportController],
  providers: [PdfService],
  exports: [PdfService],
})
export class ExportModule {}
