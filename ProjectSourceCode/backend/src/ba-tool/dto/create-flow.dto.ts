import { IsString, IsNotEmpty, IsArray, MaxLength } from 'class-validator';

export class CreateBaFlowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  flowName: string;

  @IsArray()
  @IsNotEmpty()
  steps: { screenId: string; triggerLabel: string; outcome?: string }[];
}
