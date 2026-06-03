/**
 * Tests for the section value normalizer (Sprint v6 · Track S · F2).
 * The critical guarantee is ROUND-TRIP STABILITY on legacy flat data:
 * `toFlat(toStructured(x)) === x` for every legacy field value, so wiring the
 * seam into existing readers is a behavioural no-op until structured data lands.
 */

import {
  AI_PREFIX,
  NEW_PREFIX,
  isStructuredField,
  toStructured,
  toFlat,
  isAi,
  isLocked,
  displayText,
  flattenValue,
  flattenSections,
  type StructuredField,
} from './section-normalizer';

describe('section-normalizer', () => {
  describe('toStructured', () => {
    it('maps a plain string to editedContent', () => {
      expect(toStructured('Hello world')).toEqual({ editedContent: 'Hello world' });
    });

    it('maps an [AI]-prefixed string to aiContent', () => {
      expect(toStructured(`${AI_PREFIX}Generated text`)).toEqual({ aiContent: 'Generated text' });
    });

    it('maps an [AI] [NEW] string to aiContent + isNew', () => {
      expect(toStructured(`${AI_PREFIX}${NEW_PREFIX}Brand new requirement`)).toEqual({
        aiContent: 'Brand new requirement',
        isNew: true,
      });
    });

    it('maps null/undefined to an empty field', () => {
      expect(toStructured(null)).toEqual({});
      expect(toStructured(undefined)).toEqual({});
    });

    it('passes through an already-structured field, keeping only known keys', () => {
      const input = {
        aiContent: 'a',
        editedContent: 'b',
        lockedAt: '2026-06-03T00:00:00.000Z',
        lastEditedAt: '2026-06-03T01:00:00.000Z',
        // unknown keys must be dropped
        bogus: 'x',
      } as unknown;
      expect(toStructured(input)).toEqual({
        aiContent: 'a',
        editedContent: 'b',
        lockedAt: '2026-06-03T00:00:00.000Z',
        lastEditedAt: '2026-06-03T01:00:00.000Z',
      });
    });

    it('treats a non-string scalar as a human literal', () => {
      expect(toStructured(42)).toEqual({ editedContent: '42' });
      expect(toStructured(true)).toEqual({ editedContent: 'true' });
    });
  });

  describe('toFlat', () => {
    it('returns edited content without an [AI] prefix (human wins)', () => {
      expect(toFlat({ aiContent: 'ai', editedContent: 'human' })).toBe('human');
    });

    it('re-applies [AI] for AI-only content', () => {
      expect(toFlat({ aiContent: 'machine' })).toBe(`${AI_PREFIX}machine`);
    });

    it('preserves the [NEW] marker after [AI]', () => {
      expect(toFlat({ aiContent: 'x', isNew: true })).toBe(`${AI_PREFIX}${NEW_PREFIX}x`);
    });

    it('returns empty string for an empty field', () => {
      expect(toFlat({})).toBe('');
    });
  });

  describe('round-trip stability on legacy flat data', () => {
    const legacy = [
      'plain human text',
      `${AI_PREFIX}ai generated text`,
      `${AI_PREFIX}${NEW_PREFIX}net-new ai item`,
      '',
      'multi\nline\ntext',
      `${AI_PREFIX}value with [brackets] inside`,
    ];
    it.each(legacy)('toFlat(toStructured(%j)) is identity', (value) => {
      expect(toFlat(toStructured(value))).toBe(value);
    });
  });

  describe('isAi / isLocked', () => {
    it('isAi true only for un-edited AI content', () => {
      expect(isAi({ aiContent: 'x' })).toBe(true);
      expect(isAi({ aiContent: 'x', editedContent: 'y' })).toBe(false);
      expect(isAi({ editedContent: 'y' })).toBe(false);
    });
    it('isLocked reflects lockedAt', () => {
      expect(isLocked({ lockedAt: '2026-06-03T00:00:00.000Z' })).toBe(true);
      expect(isLocked({})).toBe(false);
      expect(isLocked({ lockedAt: null })).toBe(false);
    });
  });

  describe('isStructuredField', () => {
    it('accepts a real structured field', () => {
      expect(isStructuredField({ aiContent: 'x' })).toBe(true);
      expect(isStructuredField({ editedContent: 'y', lockedAt: null })).toBe(true);
    });
    it('rejects a domain object (FRD feature) with unknown keys', () => {
      expect(isStructuredField({ featureId: 'FR-1', description: '[AI] foo' })).toBe(false);
    });
    it('rejects primitives, arrays, null, and empty objects', () => {
      expect(isStructuredField('x')).toBe(false);
      expect(isStructuredField(['x'])).toBe(false);
      expect(isStructuredField(null)).toBe(false);
      expect(isStructuredField({})).toBe(false);
      // object with only metadata keys but no content is not a content field
      expect(isStructuredField({ lockedAt: 'x' })).toBe(false);
    });
  });

  describe('displayText', () => {
    it('is identity on legacy flat strings', () => {
      expect(displayText(`${AI_PREFIX}foo`)).toBe(`${AI_PREFIX}foo`);
      expect(displayText('bar')).toBe('bar');
    });
    it('renders a structured field to flat display', () => {
      expect(displayText({ aiContent: 'foo' } as StructuredField)).toBe(`${AI_PREFIX}foo`);
    });
  });

  describe('flattenValue (deep)', () => {
    it('flattens nested FRD-style feature arrays', () => {
      const section = {
        '6.1_moduleId': 'MOD-01',
        '6.1_features': [
          { featureId: 'FR-1', description: `${AI_PREFIX}does a thing`, priority: 'HIGH' },
          { featureId: 'FR-2', description: { aiContent: 'edited later', editedContent: 'human desc' } },
        ],
      };
      expect(flattenValue(section)).toEqual({
        '6.1_moduleId': 'MOD-01',
        '6.1_features': [
          { featureId: 'FR-1', description: `${AI_PREFIX}does a thing`, priority: 'HIGH' },
          { featureId: 'FR-2', description: 'human desc' },
        ],
      });
    });

    it('preserves numbers and booleans', () => {
      expect(flattenValue({ a: 1, b: true, c: 'x' })).toEqual({ a: 1, b: true, c: 'x' });
    });
  });

  describe('flattenSections', () => {
    it('flattens every section body and is identity on legacy data', () => {
      const sections = {
        '1': { objective: `${AI_PREFIX}Build a thing`, owner: 'Jane' },
        '2': { scope: 'In scope: A, B' },
      };
      expect(flattenSections(sections)).toEqual(sections);
    });
    it('returns {} for null/undefined', () => {
      expect(flattenSections(null)).toEqual({});
      expect(flattenSections(undefined)).toEqual({});
    });
  });
});
