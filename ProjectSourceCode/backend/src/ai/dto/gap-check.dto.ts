import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class GapCheckDto {
  @IsObject()
  sections!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  answers?: string;
}
