import { IsOptional, IsIn, IsString, MaxLength } from 'class-validator';

export type BrdUpdateStatus = 'DRAFT' | 'COMPLETE' | 'APPROVED';

/**
 * Update one or more parts of a BRD. Sections are a partial map keyed by
 * section number (string '1' through '15'); only the keys present overwrite.
 *
 * `productName` and `audience` patch the BRD's `meta` JSON in-place — used by
 * the Stage 2 page to persist metadata edits without a full regeneration.
 * Downstream stages (AN / wireframes / hi-fi) read these from BRD meta when
 * pre-filling their own forms.
 */
export class UpdateBrdDto {
  /** Partial update of the 15-section markdown map. e.g. { "6": "## 6. Functional Requirements\n..." } */
  @IsOptional()
  sections?: Record<string, string>;

  @IsOptional()
  frTable?: { id: string; requirement: string; testable: boolean }[];

  @IsOptional()
  openItems?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsIn(['internal-tool', 'end-client-product'])
  audience?: 'internal-tool' | 'end-client-product';

  @IsOptional()
  @IsIn(['DRAFT', 'COMPLETE', 'APPROVED'])
  status?: BrdUpdateStatus;
}
