import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const SPRINT_STATUSES = ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

/**
 * H1 — DTOs for Sprint B1/B2/B3 endpoints. Same rationale as execution.dto.ts:
 * the prior plain-interface bodies bypassed ValidationPipe entirely.
 */
export class CreateSprintDto {
  @IsString() @MinLength(1) @MaxLength(50)
  sprintCode!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  goal?: string | null;

  @IsOptional() @IsISO8601()
  startDate?: string | null;

  @IsOptional() @IsISO8601()
  endDate?: string | null;

  @IsOptional() @IsEnum(SPRINT_STATUSES)
  status?: (typeof SPRINT_STATUSES)[number];
}

export class UpdateSprintDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  sprintCode?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  goal?: string | null;

  @IsOptional() @IsISO8601()
  startDate?: string | null;

  @IsOptional() @IsISO8601()
  endDate?: string | null;

  @IsOptional() @IsEnum(SPRINT_STATUSES)
  status?: (typeof SPRINT_STATUSES)[number];
}
