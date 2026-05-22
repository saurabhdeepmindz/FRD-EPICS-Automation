import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GenerateHifiDto {
  /** Use the latest lo-fi wireframe set when omitted. */
  @IsOptional()
  @IsUUID('4')
  wireframeSetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  /** Free-form notes that influence the synthetic seed (e.g. "use Indian
   *  jewellery names"). Optional — when omitted, AI invents coherent data. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  syntheticDataHint?: string;
}
