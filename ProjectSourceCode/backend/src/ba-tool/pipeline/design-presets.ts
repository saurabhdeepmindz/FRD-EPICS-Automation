/**
 * Starter design-system presets (Sprint v9 · Track BB) — the shipped template
 * library. Each is a full token set built by merging overrides onto the defaults
 * via `normalizeTokens`, so adding/removing token fields never breaks a preset.
 */
import { DesignTokens, DEFAULT_TOKENS, normalizeTokens } from './design-tokens';

export interface SeedPreset {
  name: string;
  tokens: DesignTokens;
}

export const SEED_PRESETS: SeedPreset[] = [
  {
    // The reference look from the user's sample wireframes.
    name: 'Deepmindz Navy / Orange',
    tokens: DEFAULT_TOKENS,
  },
  {
    name: 'Minimal Mono',
    tokens: normalizeTokens({
      brand: { primary: '#111827', cta: '#111827', ctaHover: '#374151', surface: '#FFFFFF' },
      neutral: { bgPage: '#FFFFFF', bgSoft: '#F9FAFB', textPrimary: '#111827', textMuted: '#6B7280', textSubtle: '#9CA3AF', border: '#E5E7EB', borderMedium: '#D1D5DB' },
      semantic: { success: '#16A34A', warning: '#CA8A04', danger: '#DC2626', info: '#2563EB', teal: '#0F766E', purple: '#6D28D9' },
      typography: { uiFont: 'Inter', monoFont: 'JetBrains Mono', baseSize: 14, weightNormal: 400, weightBold: 600 },
      shape: { radiusCard: 8, radiusPill: 999, density: 'compact', elevation: 'flat' },
    }),
  },
  {
    name: 'Corporate Blue',
    tokens: normalizeTokens({
      brand: { primary: '#0F2A52', cta: '#2563EB', ctaHover: '#3B82F6', surface: '#FFFFFF' },
      neutral: { bgPage: '#EEF2F7', bgSoft: '#F6F9FC', textPrimary: '#13294B', textMuted: '#5B6B82', textSubtle: '#93A1B5', border: '#DCE4EE', borderMedium: '#C3CFDE' },
      semantic: { success: '#15803D', warning: '#B45309', danger: '#B91C1C', info: '#1D4ED8', teal: '#0E7490', purple: '#6D28D9' },
      shape: { radiusCard: 10, radiusPill: 999, density: 'comfortable', elevation: 'soft' },
    }),
  },
  {
    name: 'Playful',
    tokens: normalizeTokens({
      brand: { primary: '#3B0764', cta: '#EC4899', ctaHover: '#F472B6', surface: '#FFFFFF' },
      neutral: { bgPage: '#FDF4FF', bgSoft: '#FAF5FF', textPrimary: '#3B0764', textMuted: '#7E5A9B', textSubtle: '#A78BBE', border: '#F0DDF8', borderMedium: '#E2C5EF' },
      semantic: { success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#8B5CF6', teal: '#14B8A6', purple: '#A855F7' },
      typography: { uiFont: 'Poppins', monoFont: 'JetBrains Mono', baseSize: 15, weightNormal: 400, weightBold: 700 },
      shape: { radiusCard: 18, radiusPill: 999, density: 'comfortable', elevation: 'raised' },
    }),
  },
];
