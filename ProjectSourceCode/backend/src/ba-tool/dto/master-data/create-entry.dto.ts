import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BaMasterDataCategory, BaMasterDataScope } from '@prisma/client';

export class CreateMasterDataEntryDto {
  @IsEnum([
    'FRONTEND_STACK', 'BACKEND_STACK', 'DATABASE', 'STREAMING', 'CACHING',
    'STORAGE', 'CLOUD', 'ARCHITECTURE', 'PROJECT_STRUCTURE', 'BACKEND_TEMPLATE',
    'FRONTEND_TEMPLATE', 'LLD_TEMPLATE', 'CODING_GUIDELINES',
  ])
  category!: BaMasterDataCategory;

  @IsOptional()
  @IsEnum(['GLOBAL', 'PROJECT'])
  scope?: BaMasterDataScope;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
