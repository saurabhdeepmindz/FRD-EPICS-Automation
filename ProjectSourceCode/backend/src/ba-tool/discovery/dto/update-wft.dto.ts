import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export type WftUpdateStatus = 'DRAFT' | 'COMPLETE' | 'APPROVED';

export class UpdateWftDto {
  @IsOptional()
  @IsString()
  @MaxLength(60_000)
  cleanedText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60_000)
  paraphrased?: string;

  // Json fields are accepted as-is; runtime validation is the writer's responsibility.
  @IsOptional()
  concepts?: unknown;

  @IsOptional()
  actionItems?: unknown;

  @IsOptional()
  openQuestions?: unknown;

  @IsOptional()
  @IsIn(['DRAFT', 'COMPLETE', 'APPROVED'])
  status?: WftUpdateStatus;
}
