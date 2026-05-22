import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHifiScreenDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** Polished HTML body for the hi-fi screen — sandboxed-iframe rendered. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  htmlContent?: string;

  /** Hi-fi callouts MUST preserve 1:1 parity with the lo-fi parent.
   *  Allow letter suffixes (e.g. "3a") only — never renumber existing items.
   *  The deterministic parity validator rejects sets that violate this rule. */
  @IsOptional()
  callouts?: { n: number | string; description: string; mappedTo: string }[];
}
