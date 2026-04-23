import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateBaProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  productName?: string;

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
  // base64 data-URI; images compressed client-side to ~200 KB max
  @MaxLength(500_000)
  clientLogo?: string;
}
