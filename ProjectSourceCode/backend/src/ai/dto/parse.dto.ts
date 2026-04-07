import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

export class ParseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60000)
  text!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(all_in_one|interactive)$/)
  mode?: string;
}
