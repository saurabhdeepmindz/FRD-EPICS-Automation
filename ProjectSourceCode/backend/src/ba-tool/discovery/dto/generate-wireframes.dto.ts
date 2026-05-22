import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GenerateWireframesDto {
  /** Use the current version when omitted. */
  @IsOptional()
  @IsUUID('4')
  approachNoteVersionId?: string;

  /** Optional subset of skill 04 §4 patterns (e.g. ["§4.1 Landing", "§4.2 Conversational chat"]).
   *  When omitted, AI auto-selects from the 13-pattern catalogue. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedPatterns?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;
}
