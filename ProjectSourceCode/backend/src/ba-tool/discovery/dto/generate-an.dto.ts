import { IsString, IsOptional, IsUUID, MaxLength, IsIn } from 'class-validator';

export type AnAudience = 'internal-tool' | 'end-client-product';

export class GenerateAnDto {
  @IsUUID('4')
  brdId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsIn(['internal-tool', 'end-client-product'])
  audience?: AnAudience;
}

/**
 * Body of POST /an/:approachNoteId/versions — append-only.
 * Captures what changed vs the prior version (mandatory for v2+ per skill 03 §8).
 */
export class CreateAnVersionDto {
  @IsString()
  @MaxLength(4000)
  changesSince!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsIn(['internal-tool', 'end-client-product'])
  audience?: AnAudience;
}
