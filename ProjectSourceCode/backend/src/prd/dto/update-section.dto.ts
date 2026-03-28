import { IsObject, IsBoolean, IsOptional } from 'class-validator';

export class UpdateSectionDto {
  @IsObject()
  content: Record<string, unknown>;   // flexible JSON — each section has its own shape

  @IsBoolean()
  @IsOptional()
  aiSuggested?: boolean;              // true when any field value was AI-generated
}
