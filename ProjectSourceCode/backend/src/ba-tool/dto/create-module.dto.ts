import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateBaModuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  moduleId: string; // e.g. MOD-01

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  moduleName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  packageName: string;
}
