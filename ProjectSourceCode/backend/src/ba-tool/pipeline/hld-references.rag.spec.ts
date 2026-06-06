import { chunkText, cosine } from './hld-references.service';

describe('references RAG helpers (v11 HD-13)', () => {
  describe('chunkText', () => {
    it('returns a single chunk for short text', () => {
      expect(chunkText('short text')).toEqual(['short text']);
    });
    it('returns [] for empty text', () => {
      expect(chunkText('   ')).toEqual([]);
    });
    it('splits long text into overlapping chunks within the size bound', () => {
      const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} about architecture.`).join(' ');
      const chunks = chunkText(text, 300, 60);
      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) expect(c.length).toBeLessThanOrEqual(360); // size + boundary slack
      // overlap: consecutive chunks share some text
      expect(chunks.join(' ').length).toBeGreaterThanOrEqual(text.length);
    });
  });

  describe('cosine', () => {
    it('is 1 for identical vectors', () => {
      expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
    });
    it('is 0 for orthogonal vectors', () => {
      expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
    });
    it('ranks a closer vector higher', () => {
      const q = [1, 1, 0];
      const near = cosine(q, [1, 1, 0.1]);
      const far = cosine(q, [0, 0, 1]);
      expect(near).toBeGreaterThan(far);
    });
    it('returns 0 on degenerate/mismatched input', () => {
      expect(cosine([], [])).toBe(0);
      expect(cosine([1, 2], [1, 2, 3])).toBe(0);
      expect(cosine([0, 0], [0, 0])).toBe(0);
    });
  });
});
