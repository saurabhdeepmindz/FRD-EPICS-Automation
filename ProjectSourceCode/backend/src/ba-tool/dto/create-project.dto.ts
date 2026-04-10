import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateBaProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  projectCode: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
