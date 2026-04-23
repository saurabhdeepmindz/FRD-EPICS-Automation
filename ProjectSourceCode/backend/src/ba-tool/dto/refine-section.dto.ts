import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class RefineSectionDto {
  @IsString()
  @IsNotEmpty()
  artifactType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  sectionLabel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  currentText!: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  moduleContext?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  instruction?: string;
}
