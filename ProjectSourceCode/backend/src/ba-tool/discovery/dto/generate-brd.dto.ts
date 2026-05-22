import { IsString, IsOptional, IsUUID, MaxLength, IsIn } from 'class-validator';

export type BrdAudience = 'internal-tool' | 'end-client-product';

export class GenerateBrdDto {
  @IsUUID('4')
  wftId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsIn(['internal-tool', 'end-client-product'])
  audience?: BrdAudience;
}
