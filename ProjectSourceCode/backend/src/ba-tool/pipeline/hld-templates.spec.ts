import { BUILTIN_ARCH_TEMPLATES, libraryTemplateToHld } from './hld-templates';

describe('hld-templates (v10 Track D)', () => {
  it('ships curated built-in architecture patterns with the required shape', () => {
    expect(BUILTIN_ARCH_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const t of BUILTIN_ARCH_TEMPLATES) {
      expect(t.id).toMatch(/^builtin:/);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.summary.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
      expect(t.source).toBe('builtin');
    }
  });

  it('has unique ids', () => {
    const ids = BUILTIN_ARCH_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps a library (BaTemplate) row into the shared HldTemplate shape', () => {
    const row = { id: 'abc-123', name: 'Org RAG blueprint', content: 'Use pgvector with hybrid search.' };
    const t = libraryTemplateToHld(row);
    expect(t.id).toBe('library:abc-123');
    expect(t.name).toBe('Org RAG blueprint');
    expect(t.body).toBe('Use pgvector with hybrid search.');
    expect(t.source).toBe('library');
  });

  it('truncates long library content into a summary with an ellipsis', () => {
    const long = 'x'.repeat(300);
    const t = libraryTemplateToHld({ id: '1', name: 'Big', content: long });
    expect(t.summary.endsWith('…')).toBe(true);
    expect(t.summary.length).toBeLessThan(long.length);
    expect(t.body).toBe(long); // full body preserved
  });
});
