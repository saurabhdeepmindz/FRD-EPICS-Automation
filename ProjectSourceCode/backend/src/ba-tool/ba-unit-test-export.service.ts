import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as archiver from 'archiver';
import { PrismaService } from '../prisma/prisma.service';

type Lang = 'python' | 'typescript' | 'javascript' | 'java' | 'unknown';

interface ExtractedFn {
  name: string;
  kind: 'function' | 'method' | 'class';
  params: string;
  className?: string;
}

/**
 * D1 — Unit-test scaffold generator. Takes an LLD artifact's pseudo-files,
 * parses function/class signatures via lightweight regex (language-agnostic
 * at the pseudo-code level), and emits runnable test scaffolds:
 *
 *   - Python  → pytest, one `test_<file>.py` with failing `test_<fn>_happy_path`
 *   - TS/JS   → Jest, one `<file>.test.ts` with describe/it blocks
 *   - Java    → JUnit5, one `<Name>Test.java`
 *   - Other   → skipped with a note in README
 *
 * Deterministic template codegen — no AI call. Adjacent to Playwright export.
 *
 * The ZIP ships with minimal runner scaffolding (pytest.ini, package.json,
 * pom.xml) so a dev can clone, install, and see red-failing tests on day 1.
 */
@Injectable()
export class BaUnitTestExportService {
  private readonly logger = new Logger(BaUnitTestExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildZip(lldArtifactDbId: string): Promise<{ buffer: Buffer; filename: string }> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: lldArtifactDbId },
      include: {
        pseudoFiles: { orderBy: { path: 'asc' } },
        module: { select: { id: true, moduleId: true, moduleName: true, projectId: true } },
      },
    });
    if (!artifact) throw new NotFoundException(`LLD artifact ${lldArtifactDbId} not found`);
    if (artifact.artifactType !== 'LLD') {
      throw new NotFoundException(`Artifact ${lldArtifactDbId} is not an LLD`);
    }

    const generated: Array<{ path: string; lang: Lang; fns: ExtractedFn[]; skipped?: string }> = [];
    for (const pf of artifact.pseudoFiles) {
      const content = pf.editedContent || pf.aiContent || '';
      const lang = this.detectLanguage(pf.path, pf.language);
      if (lang === 'unknown') {
        generated.push({ path: pf.path, lang, fns: [], skipped: 'Unsupported language' });
        continue;
      }
      const fns = this.extractFunctions(content, lang);
      generated.push({ path: pf.path, lang, fns });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));

    archive.append(this.buildReadme(artifact, generated), { name: 'README.md' });

    // Collect per-language outputs so package/config files are written only once.
    const hasPy = generated.some((g) => g.lang === 'python' && g.fns.length > 0);
    const hasJs = generated.some((g) => (g.lang === 'typescript' || g.lang === 'javascript') && g.fns.length > 0);
    const hasJava = generated.some((g) => g.lang === 'java' && g.fns.length > 0);

    if (hasPy) {
      archive.append(this.pythonRequirements(), { name: 'python/requirements.txt' });
      archive.append(this.pythonConftest(), { name: 'python/conftest.py' });
      archive.append(this.pythonPytestIni(), { name: 'python/pytest.ini' });
    }
    if (hasJs) {
      archive.append(this.jsPackageJson(artifact.artifactId), { name: 'javascript/package.json' });
      archive.append(this.jsJestConfig(), { name: 'javascript/jest.config.js' });
      archive.append(this.jsTsConfig(), { name: 'javascript/tsconfig.json' });
    }
    if (hasJava) {
      archive.append(this.javaPom(artifact.artifactId), { name: 'java/pom.xml' });
    }

    for (const g of generated) {
      if (g.fns.length === 0) continue;
      if (g.lang === 'python') {
        const fileName = this.pythonTestFileName(g.path);
        archive.append(this.renderPythonTests(g.path, g.fns), { name: `python/tests/${fileName}` });
      } else if (g.lang === 'typescript' || g.lang === 'javascript') {
        const fileName = this.jsTestFileName(g.path, g.lang);
        archive.append(this.renderJsTests(g.path, g.fns, g.lang), { name: `javascript/tests/${fileName}` });
      } else if (g.lang === 'java') {
        const fileName = this.javaTestFileName(g.path);
        archive.append(this.renderJavaTests(g.path, g.fns), { name: `java/src/test/java/${fileName}` });
      }
    }

    await archive.finalize();
    const buffer = Buffer.concat(chunks);
    const filename = `${artifact.artifactId}-unit-tests.zip`;
    return { buffer, filename };
  }

  // ─── Language detection ─────────────────────────────────────────────────

  private detectLanguage(path: string, declared: string | null): Lang {
    const lower = (declared ?? '').toLowerCase();
    if (lower.includes('python')) return 'python';
    if (lower.includes('typescript') || lower === 'ts') return 'typescript';
    if (lower.includes('javascript') || lower === 'js') return 'javascript';
    if (lower.includes('java') && !lower.includes('script')) return 'java';

    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (['py'].includes(ext)) return 'python';
    if (['ts', 'tsx'].includes(ext)) return 'typescript';
    if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
    if (['java'].includes(ext)) return 'java';
    return 'unknown';
  }

  // ─── Function extraction (regex, pseudo-code grade) ─────────────────────

  private extractFunctions(content: string, lang: Lang): ExtractedFn[] {
    const out: ExtractedFn[] = [];
    const seen = new Set<string>();
    const add = (fn: ExtractedFn) => {
      const key = `${fn.kind}:${fn.className ?? ''}.${fn.name}`;
      if (!seen.has(key) && fn.name && !fn.name.startsWith('_')) {
        seen.add(key);
        out.push(fn);
      }
    };

    if (lang === 'python') {
      // def name(args):  — also picks up class methods (indent doesn't matter
      // for name extraction; we rely on class context below).
      let currentClass: string | undefined;
      for (const rawLine of content.split(/\r?\n/)) {
        const classMatch = /^class\s+([A-Z]\w*)\s*[:\(]/.exec(rawLine);
        if (classMatch) {
          currentClass = classMatch[1];
          add({ name: currentClass, kind: 'class', params: '' });
          continue;
        }
        const fnMatch = /^\s*(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/.exec(rawLine);
        if (fnMatch) {
          const indented = /^\s+/.test(rawLine);
          add({
            name: fnMatch[1],
            kind: indented && currentClass ? 'method' : 'function',
            params: fnMatch[2].trim(),
            className: indented ? currentClass : undefined,
          });
        }
      }
    } else if (lang === 'typescript' || lang === 'javascript') {
      // Several JS/TS function shapes. We only need names for stubs.
      const patterns: RegExp[] = [
        /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)/g,
        /(?:export\s+)?const\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
        /(?:export\s+)?const\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
      ];
      for (const p of patterns) {
        let m;
        p.lastIndex = 0;
        while ((m = p.exec(content)) !== null) {
          add({ name: m[1], kind: 'function', params: m[2].trim() });
        }
      }
      const classRe = /(?:export\s+)?class\s+([A-Z][\w$]*)/g;
      let cm;
      while ((cm = classRe.exec(content)) !== null) {
        add({ name: cm[1], kind: 'class', params: '' });
      }
    } else if (lang === 'java') {
      // public <modifiers> ReturnType name(args)  — crude but fine for stubs.
      const classRe = /(?:public|protected|private)?\s*(?:abstract|final)?\s*class\s+(\w+)/g;
      let cm;
      while ((cm = classRe.exec(content)) !== null) {
        add({ name: cm[1], kind: 'class', params: '' });
      }
      const methodRe = /(?:public|protected|private)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?\s+)+([a-zA-Z_]\w*)\s*\(([^)]*)\)/g;
      let mm;
      while ((mm = methodRe.exec(content)) !== null) {
        if (!['if', 'while', 'for', 'switch', 'catch'].includes(mm[1])) {
          add({ name: mm[1], kind: 'method', params: mm[2].trim() });
        }
      }
    }

    return out;
  }

  // ─── Per-language renderers ─────────────────────────────────────────────

  private pythonTestFileName(sourcePath: string): string {
    const base = sourcePath.split('/').pop()!.replace(/\.py$/i, '');
    const snake = this.toSnakeCase(base);
    return `test_${snake}.py`;
  }

  private jsTestFileName(sourcePath: string, lang: Lang): string {
    const base = sourcePath.split('/').pop()!.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, '');
    const ext = lang === 'typescript' ? 'ts' : 'js';
    return `${base}.test.${ext}`;
  }

  private javaTestFileName(sourcePath: string): string {
    const base = sourcePath.split('/').pop()!.replace(/\.java$/i, '');
    return `${base}Test.java`;
  }

  private toSnakeCase(s: string): string {
    return s
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  }

  private renderPythonTests(sourcePath: string, fns: ExtractedFn[]): string {
    const lines: string[] = [
      `# AUTO-GENERATED by BA Tool (D1 — Unit Test Scaffold)`,
      `# Source pseudo-file: ${sourcePath}`,
      `# These tests intentionally FAIL until implementation exists.`,
      `# Replace \`pytest.fail(...)\` with real assertions as you implement.`,
      ``,
      `import pytest`,
      ``,
    ];
    for (const fn of fns) {
      const testName = this.toSnakeCase(fn.className ? `${fn.className}_${fn.name}` : fn.name);
      lines.push(`class Test${fn.className ?? this.toPascal(fn.name)}:`);
      lines.push(`    """Scaffold for ${fn.kind} \`${fn.className ? fn.className + '.' : ''}${fn.name}\`."""`);
      lines.push(``);
      lines.push(`    def test_${testName}_happy_path(self):`);
      lines.push(`        # Arrange`);
      lines.push(`        # TODO: set up inputs / mocks for: ${fn.params || '(no args)'}`);
      lines.push(`        # Act`);
      lines.push(`        # result = ${fn.className ? fn.className.toLowerCase() + '.' : ''}${fn.name}(...)`);
      lines.push(`        # Assert`);
      lines.push(`        pytest.fail("Not implemented — remove this when real assertions land")`);
      lines.push(``);
      lines.push(`    def test_${testName}_invalid_input_raises(self):`);
      lines.push(`        # TODO: cover negative / edge cases`);
      lines.push(`        pytest.fail("Not implemented")`);
      lines.push(``);
    }
    if (fns.length === 0) {
      lines.push(`def test_placeholder():`);
      lines.push(`    """No functions were parsed from ${sourcePath} — add tests manually."""`);
      lines.push(`    pytest.fail("Not implemented")`);
    }
    return lines.join('\n') + '\n';
  }

  private renderJsTests(sourcePath: string, fns: ExtractedFn[], lang: Lang): string {
    const base = sourcePath.split('/').pop()!.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, '');
    const importPath = `../src/${sourcePath.replace(/^src\//, '').replace(/\.(tsx?|jsx?|mjs|cjs)$/i, '')}`;
    const lines: string[] = [
      `// AUTO-GENERATED by BA Tool (D1 — Unit Test Scaffold)`,
      `// Source pseudo-file: ${sourcePath}`,
      `// These tests intentionally FAIL until implementation exists.`,
      ``,
    ];
    if (fns.length > 0) {
      const importables = fns.filter((f) => f.kind !== 'method').map((f) => f.name).slice(0, 10);
      if (importables.length > 0 && lang === 'typescript') {
        lines.push(`// Uncomment once the source module exists:`);
        lines.push(`// import { ${importables.join(', ')} } from '${importPath}';`);
      } else if (importables.length > 0) {
        lines.push(`// Uncomment once the source module exists:`);
        lines.push(`// const { ${importables.join(', ')} } = require('${importPath}');`);
      }
      lines.push(``);
    }
    lines.push(`describe('${base}', () => {`);
    for (const fn of fns) {
      const label = fn.className ? `${fn.className}.${fn.name}` : fn.name;
      lines.push(`  describe('${label} (${fn.kind})', () => {`);
      lines.push(`    it('happy path — TODO', () => {`);
      lines.push(`      // Arrange: set up inputs / mocks for (${fn.params || 'no args'})`);
      lines.push(`      // Act:     const result = ${fn.name}(...);`);
      lines.push(`      // Assert:  expect(result).toBe(...);`);
      lines.push(`      expect(true).toBe(false); // fail until implemented`);
      lines.push(`    });`);
      lines.push(``);
      lines.push(`    it('invalid input throws — TODO', () => {`);
      lines.push(`      expect(() => { throw new Error('Not implemented'); }).toThrow();`);
      lines.push(`    });`);
      lines.push(`  });`);
      lines.push(``);
    }
    if (fns.length === 0) {
      lines.push(`  it.skip('no functions parsed — add tests manually', () => { /* */ });`);
    }
    lines.push(`});`);
    return lines.join('\n') + '\n';
  }

  private renderJavaTests(sourcePath: string, fns: ExtractedFn[]): string {
    const base = sourcePath.split('/').pop()!.replace(/\.java$/i, '');
    const lines: string[] = [
      `// AUTO-GENERATED by BA Tool (D1 — Unit Test Scaffold)`,
      `// Source pseudo-file: ${sourcePath}`,
      ``,
      `import org.junit.jupiter.api.Test;`,
      `import static org.junit.jupiter.api.Assertions.*;`,
      ``,
      `public class ${base}Test {`,
      ``,
    ];
    for (const fn of fns) {
      const testName = `test_${this.toSnakeCase(fn.className ? `${fn.className}_${fn.name}` : fn.name)}_happyPath`;
      lines.push(`    @Test`);
      lines.push(`    void ${testName}() {`);
      lines.push(`        // Arrange — inputs for (${fn.params || 'no args'})`);
      lines.push(`        // Act —      ${fn.name}(...)`);
      lines.push(`        // Assert`);
      lines.push(`        fail("Not implemented — ${fn.name}");`);
      lines.push(`    }`);
      lines.push(``);
    }
    if (fns.length === 0) {
      lines.push(`    @Test`);
      lines.push(`    void testPlaceholder() { fail("No functions parsed"); }`);
    }
    lines.push(`}`);
    return lines.join('\n') + '\n';
  }

  // ─── Scaffolding files ──────────────────────────────────────────────────

  private buildReadme(
    artifact: { artifactId: string; module: { moduleId: string; moduleName: string } },
    generated: Array<{ path: string; lang: Lang; fns: ExtractedFn[]; skipped?: string }>,
  ): string {
    const byLang = new Map<Lang, Array<{ path: string; count: number }>>();
    for (const g of generated) {
      if (g.skipped) continue;
      const list = byLang.get(g.lang) ?? [];
      list.push({ path: g.path, count: g.fns.length });
      byLang.set(g.lang, list);
    }
    const skipped = generated.filter((g) => g.skipped);
    const lines: string[] = [
      `# Unit Test Scaffold — ${artifact.artifactId}`,
      ``,
      `Module: **${artifact.module.moduleId} — ${artifact.module.moduleName}**`,
      ``,
      `This bundle is a **starting point**. Every test currently fails on purpose so`,
      `that as you implement each function the suite turns green step by step.`,
      ``,
      `## What's inside`,
      ``,
    ];
    for (const [lang, files] of byLang) {
      const total = files.reduce((s, f) => s + f.count, 0);
      lines.push(`### ${this.langDisplay(lang)}`);
      lines.push(``);
      lines.push(`- ${files.length} test file(s), ${total} function(s)/class(es) scaffolded`);
      lines.push(`- Runner: ${this.runnerFor(lang)}`);
      lines.push(`- Location: \`${this.langFolder(lang)}/\``);
      lines.push(``);
      for (const f of files) {
        lines.push(`  - \`${f.path}\` → ${f.count} test${f.count === 1 ? '' : 's'}`);
      }
      lines.push(``);
    }
    if (skipped.length > 0) {
      lines.push(`## Skipped (unsupported language)`);
      lines.push(``);
      for (const g of skipped) {
        lines.push(`- \`${g.path}\` — ${g.skipped}`);
      }
      lines.push(``);
    }
    lines.push(`## How to run`);
    lines.push(``);
    if (byLang.has('python')) {
      lines.push(`### Python (pytest)`);
      lines.push('```bash');
      lines.push(`cd python`);
      lines.push(`pip install -r requirements.txt`);
      lines.push(`pytest`);
      lines.push('```');
      lines.push(``);
    }
    if (byLang.has('typescript') || byLang.has('javascript')) {
      lines.push(`### JavaScript / TypeScript (Jest)`);
      lines.push('```bash');
      lines.push(`cd javascript`);
      lines.push(`npm install`);
      lines.push(`npm test`);
      lines.push('```');
      lines.push(``);
    }
    if (byLang.has('java')) {
      lines.push(`### Java (JUnit 5 via Maven)`);
      lines.push('```bash');
      lines.push(`cd java`);
      lines.push(`mvn test`);
      lines.push('```');
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(`Generated by BA Tool · pseudo-code parser (regex-grade, pseudo-code level).`);
    return lines.join('\n') + '\n';
  }

  private langDisplay(l: Lang): string {
    return {
      python: 'Python',
      typescript: 'TypeScript',
      javascript: 'JavaScript',
      java: 'Java',
      unknown: 'Other',
    }[l];
  }
  private runnerFor(l: Lang): string {
    return { python: 'pytest', typescript: 'Jest + ts-jest', javascript: 'Jest', java: 'JUnit 5 + Maven', unknown: '-' }[l];
  }
  private langFolder(l: Lang): string {
    return { python: 'python', typescript: 'javascript', javascript: 'javascript', java: 'java', unknown: '.' }[l];
  }

  private pythonRequirements(): string {
    return 'pytest==8.3.3\npytest-cov==5.0.0\n';
  }
  private pythonConftest(): string {
    return `# Add fixtures or shared pytest configuration here.\n`;
  }
  private pythonPytestIni(): string {
    return `[pytest]\ntestpaths = tests\npython_files = test_*.py\naddopts = -q --strict-markers\n`;
  }

  private jsPackageJson(artifactId: string): string {
    return JSON.stringify(
      {
        name: `${artifactId.toLowerCase()}-unit-tests`,
        version: '0.0.1',
        private: true,
        scripts: { test: 'jest' },
        devDependencies: {
          jest: '^29.7.0',
          'ts-jest': '^29.2.5',
          '@types/jest': '^29.5.13',
          typescript: '^5.6.3',
        },
      },
      null,
      2,
    ) + '\n';
  }
  private jsJestConfig(): string {
    return `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.(ts|js)'],
};
`;
  }
  private jsTsConfig(): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ['tests/**/*', 'src/**/*'],
      },
      null,
      2,
    ) + '\n';
  }

  private javaPom(artifactId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>${artifactId.toLowerCase()}-unit-tests</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.11.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
`;
  }

  private toPascal(s: string): string {
    return s.replace(/(^|_|-|\s)(\w)/g, (_m, _p1, p2) => p2.toUpperCase());
  }
}
