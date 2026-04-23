import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';
import { BaMasterDataCategory, BaMasterDataScope } from '@prisma/client';

export class UploadTemplateDto {
  @IsEnum(['PROJECT_STRUCTURE', 'BACKEND_TEMPLATE', 'FRONTEND_TEMPLATE', 'LLD_TEMPLATE', 'CODING_GUIDELINES'])
  category!: Exclude<
    BaMasterDataCategory,
    'FRONTEND_STACK' | 'BACKEND_STACK' | 'DATABASE' | 'STREAMING' | 'CACHING' | 'STORAGE' | 'CLOUD' | 'ARCHITECTURE'
  >;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(['GLOBAL', 'PROJECT'])
  scope?: BaMasterDataScope;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
