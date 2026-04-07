import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { ExtractService } from './extract.service';

@Module({
  controllers: [UploadController],
  providers: [ExtractService],
  exports: [ExtractService],
})
export class UploadModule {}
