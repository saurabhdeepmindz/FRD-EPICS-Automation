import { IsOptional, IsIn } from 'class-validator';
import type { AnPrdReadiness } from '../../../ai/ai.service';

export type AnVersionUpdateStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';

/**
 * Update one or more parts of a specific Approach Note version.
 * `sections` is a partial map keyed by section number ('1'..'12');
 * only the keys present overwrite. Append-only versioning means we never
 * delete prior versions — but the *current draft* version's sections /
 * brand tokens / decisions / prdReadiness can be edited in place.
 */
export class UpdateAnVersionDto {
  @IsOptional()
  sections?: Record<string, string>;

  @IsOptional()
  brandTokens?: {
    primary?: string;
    surface?: string;
    cta?: string;
    logo?: string | null;
    productName?: string;
  };

  @IsOptional()
  decisionsLocked?: { question: string; decision: string }[];

  @IsOptional()
  openQuestions?: { number: number; question: string; default: string }[];

  /**
   * §12 PRD-Readiness Bridge — partial updates allowed. The editor sends only
   * the sub-sections that changed; missing keys preserve the prior values.
   */
  @IsOptional()
  prdReadiness?: Partial<AnPrdReadiness>;

  @IsOptional()
  @IsIn(['DRAFT', 'REVIEW', 'APPROVED'])
  status?: AnVersionUpdateStatus;
}
