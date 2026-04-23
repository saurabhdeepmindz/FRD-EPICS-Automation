import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMasterDataEntryDto } from './create-entry.dto';

export class BulkUploadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateMasterDataEntryDto)
  entries!: CreateMasterDataEntryDto[];
}
