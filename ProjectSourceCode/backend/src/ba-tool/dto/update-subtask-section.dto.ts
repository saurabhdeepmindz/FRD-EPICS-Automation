import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateSubTaskSectionDto {
  @IsString()
  @IsNotEmpty()
  editedContent: string;
}
