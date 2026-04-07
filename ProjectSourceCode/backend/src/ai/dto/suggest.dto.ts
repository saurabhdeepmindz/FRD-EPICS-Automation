import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SuggestDto {
  @IsInt()
  @Min(1)
  @Max(22)
  section!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  field!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  context?: string;
}
