import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * H1 — Input sanitization DTOs for Phase 2a endpoints.
 *
 * ValidationPipe is configured globally with `whitelist + forbidNonWhitelisted`,
 * but it only acts against DTO *classes* with class-validator decorators. Prior
 * to H1 these endpoints accepted `@Body() payload: CreateTestRunPayload` —
 * bare TypeScript interfaces, which means the pipe had nothing to validate and
 * arbitrary JSON (including extra/malicious fields) reached the service.
 */

const RUN_STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'] as const;
const SEVERITIES = ['P0', 'P1', 'P2', 'P3'] as const;
const DEFECT_STATUSES = ['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED', 'WONT_FIX'] as const;

class DefectOnRunDto {
  @IsString() @MaxLength(300)
  title!: string;

  @IsOptional() @IsString() @MaxLength(4000)
  description?: string | null;

  @IsOptional() @IsEnum(SEVERITIES)
  severity?: (typeof SEVERITIES)[number] | null;

  @IsOptional() @IsString() @MaxLength(500)
  externalRef?: string | null;

  @IsOptional() @IsString() @MaxLength(4000)
  reproductionSteps?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  reportedBy?: string | null;
}

export class CreateTestRunDto {
  @IsEnum(RUN_STATUSES)
  status!: (typeof RUN_STATUSES)[number];

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  executor?: string | null;

  @IsOptional() @IsInt() @Min(0)
  durationSec?: number | null;

  @IsOptional() @IsString() @MaxLength(100)
  environment?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  sprintId?: string | null;

  @IsOptional() @IsUUID()
  sprintDbId?: string | null;

  @IsOptional() @IsISO8601()
  executedAt?: string | null;

  @IsOptional() @ValidateNested() @Type(() => DefectOnRunDto)
  defect?: DefectOnRunDto | null;
}

export class BulkCreateTestRunDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200) // aligns with server-side cap in bulkCreateRuns
  @IsUUID('4', { each: true })
  testCaseIds!: string[];

  @IsEnum(RUN_STATUSES)
  status!: (typeof RUN_STATUSES)[number];

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  executor?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  environment?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  sprintId?: string | null;

  @IsOptional() @IsUUID()
  sprintDbId?: string | null;

  @IsOptional() @IsISO8601()
  executedAt?: string | null;
}

export class CreateDefectDto {
  @IsString() @MaxLength(300)
  title!: string;

  @IsOptional() @IsString() @MaxLength(4000)
  description?: string | null;

  @IsOptional() @IsEnum(SEVERITIES)
  severity?: (typeof SEVERITIES)[number] | null;

  @IsOptional() @IsString() @MaxLength(500)
  externalRef?: string | null;

  @IsOptional() @IsString() @MaxLength(4000)
  reproductionSteps?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  environment?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  reportedBy?: string | null;
}

export class UpdateDefectDto {
  @IsOptional() @IsString() @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  description?: string | null;

  @IsOptional() @IsEnum(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @IsOptional() @IsEnum(DEFECT_STATUSES)
  status?: (typeof DEFECT_STATUSES)[number];

  @IsOptional() @IsString() @MaxLength(4000)
  reproductionSteps?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  externalRef?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  environment?: string | null;
}

export class SaveTesterRcaDto {
  @IsString() @MaxLength(4000)
  rootCause!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  contributingFactors?: string[];

  @IsOptional() @IsString() @MaxLength(4000)
  proposedFix?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  createdBy?: string | null;
}
