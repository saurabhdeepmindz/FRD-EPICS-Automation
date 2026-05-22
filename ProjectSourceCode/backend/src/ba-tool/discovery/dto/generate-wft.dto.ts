import { IsString, IsArray, ArrayNotEmpty, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class GenerateWftDto {
  /** One or more audio file IDs (must already be transcribed). */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  audioFileIds!: string[];

  /** Free-text domain hint that improves AI cleanup, e.g. "AI / CRM / sales automation". */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  domainContext?: string;

  /** Language hint passed to the WFT generator. Default 'auto'. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  languageHint?: string;
}
