import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Multipart audio upload — file comes via FileInterceptor('audio') so it's not
 * declared on this DTO. Optional retention override is a body field.
 */
export class UploadAudioDto {
  /** Days to retain raw audio after WFT generation. Default 90 per BRD §6 FR-15. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;
}
