import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWireframeScreenDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60_000)
  mdContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120_000)
  htmlContent?: string;

  @IsOptional()
  callouts?: { n: number | string; description: string; mappedTo: string }[];

  @IsOptional()
  components?: { file: string; purpose: string }[];
}
