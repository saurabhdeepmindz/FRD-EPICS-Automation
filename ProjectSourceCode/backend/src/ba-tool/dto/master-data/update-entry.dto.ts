import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateMasterDataEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
