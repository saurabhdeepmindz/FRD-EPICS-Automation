import { IsString, IsOptional, IsInt, IsBoolean, MaxLength, Min } from 'class-validator';

export class UpdateBaScreenDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  screenTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  screenType?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;

  @IsString()
  @IsOptional()
  textDescription?: string;

  @IsString()
  @IsOptional()
  audioTranscript?: string;

  @IsBoolean()
  @IsOptional()
  transcriptReviewed?: boolean;
}
