import {
  DEFAULT_TOKENS,
  AUTO_MODULE_WHEEL,
  normalizeTokens,
  tokensToCss,
  moduleColor,
  renderSamplePreview,
} from './design-tokens';
import { SEED_PRESETS } from './design-presets';
import { moduleKeyFromFr } from './wireframe-navigator.service';

describe('design-tokens (v9)', () => {
  describe('normalizeTokens', () => {
    it('fills every group from defaults when given an empty object', () => {
      const t = normalizeTokens({});
      expect(t.brand.primary).toBe(DEFAULT_TOKENS.brand.primary);
      expect(t.shape.density).toBe('comfortable');
      expect(t.platform.mobileFrameWidth).toBe(390);
    });

    it('merges a partial override onto defaults (deep, per group)', () => {
      const t = normalizeTokens({ brand: { primary: '#123456' } as never });
      expect(t.brand.primary).toBe('#123456');
      expect(t.brand.cta).toBe(DEFAULT_TOKENS.brand.cta); // untouched
    });

    it('coerces an invalid modulePalette.mode to "auto"', () => {
      const t = normalizeTokens({ modulePalette: { mode: 'weird', colors: {} } as never });
      expect(t.modulePalette.mode).toBe('auto');
    });
  });

  describe('tokensToCss', () => {
    it('emits a :root block with the brand + neutral vars', () => {
      const css = tokensToCss({ brand: { primary: '#0F2A52' } as never });
      expect(css).toContain(':root');
      expect(css).toContain('--brand-primary:#0F2A52');
      expect(css).toContain('--bg-page:');
      expect(css).toContain('--radius-pill:999px');
    });

    it('is defined for null/undefined input (falls back to defaults)', () => {
      expect(tokensToCss(undefined)).toContain('--brand-primary:#0B1B2E');
    });
  });

  describe('moduleColor', () => {
    it('prefers a manual override', () => {
      const t = normalizeTokens({ modulePalette: { mode: 'manual', colors: { AUTH: '#abcdef' } } as never });
      expect(moduleColor(t, 'AUTH', 3)).toBe('#abcdef');
    });

    it('falls back to the auto wheel by index (wrapping)', () => {
      const t = normalizeTokens({});
      expect(moduleColor(t, 'X', 0)).toBe(AUTO_MODULE_WHEEL[0]);
      expect(moduleColor(t, 'Y', AUTO_MODULE_WHEEL.length)).toBe(AUTO_MODULE_WHEEL[0]);
    });
  });

  describe('renderSamplePreview', () => {
    it('renders a web doc with the brand color applied', () => {
      const html = renderSamplePreview({ brand: { primary: '#0F2A52', productName: 'Acme' } as never }, { platform: 'web' });
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('#0F2A52');
      expect(html).toContain('Acme');
    });

    it('renders a mobile phone frame at the configured width', () => {
      const html = renderSamplePreview({ platform: { mobileFrameWidth: 414 } as never }, { platform: 'mobile' });
      expect(html).toContain('--mobile-frame-w:414px');
      expect(html).toContain('class="phone"');
    });
  });

  describe('seed presets', () => {
    it('all 4 starter presets normalize idempotently', () => {
      expect(SEED_PRESETS).toHaveLength(4);
      for (const p of SEED_PRESETS) {
        expect(normalizeTokens(p.tokens)).toEqual(p.tokens);
      }
    });
  });

  describe('navigator module grouping', () => {
    it('extracts the module key from a §6 FR-ID', () => {
      expect(moduleKeyFromFr('FR-AUTH-001')).toBe('AUTH');
      expect(moduleKeyFromFr('FR-payroll-12')).toBe('PAYROLL');
    });
    it('returns null for a non FR-ID', () => {
      expect(moduleKeyFromFr('§6')).toBeNull();
      expect(moduleKeyFromFr('')).toBeNull();
    });
  });
});
