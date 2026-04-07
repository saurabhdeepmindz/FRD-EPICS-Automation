import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreatePrdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  prdCode: string;           // e.g. PRD-LSM001

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  version?: string;          // defaults to "1.0" in Prisma schema

  @IsString()
  @IsOptional()
  @MaxLength(100)
  author?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  clientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  submittedBy?: string;

  @IsString()
  @IsOptional()
  sourceText?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  sourceFileName?: string;

  @IsString()
  @IsOptional()
  sourceFileData?: string;
}
