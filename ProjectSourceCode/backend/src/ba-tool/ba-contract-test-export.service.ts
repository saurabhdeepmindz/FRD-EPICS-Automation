import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as archiver from 'archiver';
import { PrismaService } from '../prisma/prisma.service';

type Lang = 'python' | 'typescript' | 'javascript' | 'java' | 'unknown';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Endpoint {
  method: HttpMethod;
  path: string;        // normalized: "/api/users/:id"
  role: 'provider' | 'consumer';
  sourceFile: string;
  sourceLang: Lang;
  handlerName?: string;  // provider only: function name
  className?: string;
}

interface MatchedPair {
  method: HttpMethod;
  path: string;
  provider?: Endpoint;
  consumers: Endpoint[];
}

/**
 * D2 — Contract-test scaffold generator. Walks the LLD's pseudo-files, detects
 * HTTP provider definitions (Express/Nest/Flask/FastAPI/Spring) and consumer
 * call sites (fetch/axios/httpx), normalises paths, pairs them by method+path,
 * and emits:
 *
 *   - openapi.yaml — minimal OpenAPI 3.0 stub covering every detected endpoint
 *   - contracts/providers.test.ts  — Jest+supertest shape assertions
 *   - contracts/consumers.test.ts  — Jest+msw pact-style tests
 *   - contracts/test_providers.py  — pytest + httpx shape assertions
 *   - README.md                    — what matched, what's orphaned, runner commands
 *
 * Orphan endpoints (one side without the other) are flagged in the README so
 * testers know where integration will likely break first.
 */
@Injectable()
export class BaContractTestExportService {
  private readonly logger = new Logger(BaContractTestExportService.name);

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

    const endpoints: Endpoint[] = [];
    for (const pf of artifact.pseudoFiles) {
      const content = pf.editedContent || pf.aiContent || '';
      const lang = this.detectLanguage(pf.path, pf.language);
      if (lang === 'unknown') continue;
      endpoints.push(...this.extractEndpoints(content, pf.path, lang));
    }

    const pairs = this.matchProviderConsumer(endpoints);
    const providers = pairs.filter((p) => p.provider);
    const orphanConsumers = pairs.filter((p) => !p.provider && p.consumers.length > 0);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));

    archive.append(this.buildReadme(artifact, pairs, endpoints), { name: 'README.md' });
    archive.append(this.buildOpenapiYaml(artifact, pairs), { name: 'openapi.yaml' });

    if (pairs.length > 0) {
      archive.append(this.jsPackageJson(artifact.artifactId), { name: 'javascript/package.json' });
      archive.append(this.jsJestConfig(), { name: 'javascript/jest.config.js' });
      archive.append(this.jsTsConfig(), { name: 'javascript/tsconfig.json' });
      archive.append(this.renderProviderTestsTs(providers), { name: 'javascript/contracts/providers.test.ts' });
      archive.append(this.renderConsumerTestsTs(pairs), { name: 'javascript/contracts/consumers.test.ts' });

      archive.append(this.pythonRequirements(), { name: 'python/requirements.txt' });
      archive.append(this.pythonPytestIni(), { name: 'python/pytest.ini' });
      archive.append(this.renderProviderTestsPy(providers), { name: 'python/contracts/test_providers.py' });
      archive.append(this.renderConsumerTestsPy(pairs), { name: 'python/contracts/test_consumers.py' });
    }
    if (orphanConsumers.length > 0) {
      archive.append(this.buildOrphansReport(orphanConsumers), { name: 'UNRESOLVED_CONTRACTS.md' });
    }

    await archive.finalize();
    const buffer = Buffer.concat(chunks);
    return { buffer, filename: `${artifact.artifactId}-contract-tests.zip` };
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

  // ─── Endpoint extraction (regex-grade, pseudo-code level) ───────────────

  private extractEndpoints(content: string, sourceFile: string, lang: Lang): Endpoint[] {
    const out: Endpoint[] = [];
    const push = (e: Endpoint) => {
      if (!e.path) return;
      e.path = this.normalisePath(e.path);
      out.push(e);
    };

    if (lang === 'typescript' || lang === 'javascript') {
      // Express / NestJS / Fastify / Koa — providers
      //   app.get('/users', …)  |  router.post('/users/:id', …)
      //   @Get('/users')  @Post()  @Put('/users/:id')
      const appCall = /(?:app|router|fastify|server)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let m;
      while ((m = appCall.exec(content)) !== null) {
        push({
          method: m[1].toUpperCase() as HttpMethod,
          path: m[2],
          role: 'provider',
          sourceFile,
          sourceLang: lang,
        });
      }
      const nestDecorator = /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/g;
      while ((m = nestDecorator.exec(content)) !== null) {
        push({
          method: m[1].toUpperCase() as HttpMethod,
          path: m[2] || '/',
          role: 'provider',
          sourceFile,
          sourceLang: lang,
        });
      }

      // Consumers: fetch / axios / httpx-in-js
      const fetchCall = /fetch\s*\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*\{\s*method\s*:\s*['"`](\w+)['"`])?/gi;
      while ((m = fetchCall.exec(content)) !== null) {
        push({
          method: (m[2]?.toUpperCase() as HttpMethod) || 'GET',
          path: m[1],
          role: 'consumer',
          sourceFile,
          sourceLang: lang,
        });
      }
      const axiosCall = /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      while ((m = axiosCall.exec(content)) !== null) {
        push({
          method: m[1].toUpperCase() as HttpMethod,
          path: m[2],
          role: 'consumer',
          sourceFile,
          sourceLang: lang,
        });
      }
    } else if (lang === 'python') {
      // Flask: @app.route('/x', methods=['POST'])   or   @app.get('/x')
      // FastAPI: @app.get('/x') / @router.post('/x')
      const fastApi = /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi;
      let m;
      while ((m = fastApi.exec(content)) !== null) {
        push({
          method: m[1].toUpperCase() as HttpMethod,
          path: m[2],
          role: 'provider',
          sourceFile,
          sourceLang: lang,
        });
      }
      const flaskRoute = /@app\.route\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*methods\s*=\s*\[['"](\w+)['"]\])?/gi;
      while ((m = flaskRoute.exec(content)) !== null) {
        push({
          method: (m[2]?.toUpperCase() as HttpMethod) || 'GET',
          path: m[1],
          role: 'provider',
          sourceFile,
          sourceLang: lang,
        });
      }
      // Consumers: httpx/requests
      const httpxCall = /(?:httpx|requests)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi;
      while ((m = httpxCall.exec(content)) !== null) {
        push({
          method: m[1].toUpperCase() as HttpMethod,
          path: m[2],
          role: 'consumer',
          sourceFile,
          sourceLang: lang,
        });
      }
    } else if (lang === 'java') {
      // Spring: @GetMapping("/x")  @PostMapping("/x")  @RequestMapping(value="/x", method=…)
      const mapping = /@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]/g;
      let m;
      while ((m = mapping.exec(content)) !== null) {
        push({
          method: m[1].toUpperCase() as HttpMethod,
          path: m[2],
          role: 'provider',
          sourceFile,
          sourceLang: lang,
        });
      }
    }

    return out;
  }

  // Normalise so /api/users/{id} and /api/users/:id match.
  private normalisePath(p: string): string {
    return p
      .replace(/\{([^}]+)\}/g, ':$1')
      .replace(/\/+$/, '')
      .replace(/^([^/])/, '/$1')
      .trim();
  }

  private matchProviderConsumer(endpoints: Endpoint[]): MatchedPair[] {
    const byKey = new Map<string, MatchedPair>();
    const keyOf = (m: HttpMethod, p: string) => `${m} ${p}`;
    for (const e of endpoints) {
      const key = keyOf(e.method, e.path);
      const pair = byKey.get(key) ?? { method: e.method, path: e.path, consumers: [] };
      if (e.role === 'provider' && !pair.provider) pair.provider = e;
      else if (e.role === 'consumer') pair.consumers.push(e);
      byKey.set(key, pair);
    }
    return Array.from(byKey.values()).sort((a, b) => {
      if (a.method !== b.method) return a.method.localeCompare(b.method);
      return a.path.localeCompare(b.path);
    });
  }

  // ─── OpenAPI stub ───────────────────────────────────────────────────────

  private buildOpenapiYaml(
    artifact: { artifactId: string; module: { moduleName: string } },
    pairs: MatchedPair[],
  ): string {
    const lines: string[] = [
      `openapi: 3.0.3`,
      `info:`,
      `  title: ${artifact.module.moduleName} — ${artifact.artifactId}`,
      `  version: 0.0.1`,
      `  description: |`,
      `    AUTO-GENERATED by BA Tool D2. Add request/response schemas as you`,
      `    flesh out the contracts — this stub lists detected paths only.`,
      `paths:`,
    ];
    // Group by path, then list methods under it.
    const byPath = new Map<string, MatchedPair[]>();
    for (const p of pairs) {
      const list = byPath.get(p.path) ?? [];
      list.push(p);
      byPath.set(p.path, list);
    }
    for (const [path, list] of byPath) {
      lines.push(`  ${path}:`);
      for (const pair of list) {
        lines.push(`    ${pair.method.toLowerCase()}:`);
        lines.push(`      summary: ${pair.provider ? pair.provider.sourceFile : '[orphan consumer]'}`);
        lines.push(`      responses:`);
        lines.push(`        "200":`);
        lines.push(`          description: OK`);
        lines.push(`          content:`);
        lines.push(`            application/json:`);
        lines.push(`              schema: { type: object, additionalProperties: true }`);
      }
    }
    if (pairs.length === 0) {
      lines.push(`  # No endpoints detected in pseudo-files.`);
    }
    return lines.join('\n') + '\n';
  }

  // ─── Test renderers ─────────────────────────────────────────────────────

  private renderProviderTestsTs(providers: MatchedPair[]): string {
    const lines: string[] = [
      `// AUTO-GENERATED by BA Tool (D2 — Contract Test Scaffold)`,
      `// These tests hit each detected provider endpoint and assert response`,
      `// shape. All currently FAIL — fill in the schema expectations as you`,
      `// implement each provider.`,
      ``,
      `import request from 'supertest';`,
      ``,
      `// TODO: replace with your actual app factory / URL`,
      `const BASE_URL = process.env.CONTRACT_BASE_URL ?? 'http://localhost:4000';`,
      ``,
      `describe('Provider contracts', () => {`,
    ];
    for (const p of providers) {
      const label = `${p.method} ${p.path}`;
      lines.push(`  describe('${label}', () => {`);
      lines.push(`    it('returns a JSON body matching the documented shape', async () => {`);
      lines.push(`      // Arrange inputs for path params / body / query as needed`);
      lines.push(`      const res = await request(BASE_URL).${p.method.toLowerCase()}('${this.exampleUrl(p.path)}');`);
      lines.push(`      // TODO: replace with real assertions`);
      lines.push(`      expect([200, 201, 204]).toContain(res.status);`);
      lines.push(`      expect(res.body).toBeDefined();`);
      lines.push(`      // expect(res.body).toMatchObject({ id: expect.any(String) });`);
      lines.push(`      throw new Error('Not implemented — write real shape assertions for ${label}');`);
      lines.push(`    });`);
      lines.push(`  });`);
      lines.push(``);
    }
    if (providers.length === 0) {
      lines.push(`  it.skip('no providers detected', () => { /* */ });`);
    }
    lines.push(`});`);
    return lines.join('\n') + '\n';
  }

  private renderConsumerTestsTs(pairs: MatchedPair[]): string {
    const lines: string[] = [
      `// AUTO-GENERATED by BA Tool (D2 — Contract Test Scaffold)`,
      `// Consumer-side pact-style tests using msw. The test stands up a mock`,
      `// provider that responds with the documented shape; the consumer code`,
      `// should succeed against that mock. When the real provider's shape`,
      `// drifts away from what's mocked here, you know the contract broke.`,
      ``,
      `import { setupServer } from 'msw/node';`,
      `import { http, HttpResponse } from 'msw';`,
      ``,
      `describe('Consumer contracts', () => {`,
    ];
    for (const pair of pairs) {
      if (pair.consumers.length === 0) continue;
      const label = `${pair.method} ${pair.path}`;
      lines.push(`  describe('consumer expects ${label}', () => {`);
      lines.push(`    const server = setupServer(`);
      lines.push(`      http.${pair.method.toLowerCase()}('${this.mswPath(pair.path)}', () => {`);
      lines.push(`        // TODO: replace with the shape your consumer actually relies on`);
      lines.push(`        return HttpResponse.json({ ok: true });`);
      lines.push(`      }),`);
      lines.push(`    );`);
      lines.push(`    beforeAll(() => server.listen());`);
      lines.push(`    afterEach(() => server.resetHandlers());`);
      lines.push(`    afterAll(() => server.close());`);
      lines.push(``);
      lines.push(`    it('consumer works against the mocked provider', async () => {`);
      for (const c of pair.consumers.slice(0, 3)) {
        lines.push(`      // consumer callsite: ${c.sourceFile}`);
      }
      lines.push(`      // TODO: invoke the real consumer function and assert the result`);
      lines.push(`      throw new Error('Not implemented — wire the real consumer into this test');`);
      lines.push(`    });`);
      lines.push(`  });`);
      lines.push(``);
    }
    if (!pairs.some((p) => p.consumers.length > 0)) {
      lines.push(`  it.skip('no consumer calls detected', () => { /* */ });`);
    }
    lines.push(`});`);
    return lines.join('\n') + '\n';
  }

  private renderProviderTestsPy(providers: MatchedPair[]): string {
    const lines: string[] = [
      `# AUTO-GENERATED by BA Tool (D2 — Contract Test Scaffold)`,
      `# Provider-side contract tests. Uses httpx to hit the running service`,
      `# and assert response shape. All tests FAIL until you replace the`,
      `# placeholder assertion with a real pydantic schema check.`,
      ``,
      `import os`,
      `import pytest`,
      `import httpx`,
      ``,
      `BASE_URL = os.environ.get("CONTRACT_BASE_URL", "http://localhost:4000")`,
      ``,
    ];
    for (const p of providers) {
      const testName = this.pyTestName(p.method, p.path);
      lines.push(`class Test${testName}:`);
      lines.push(`    """${p.method} ${p.path}"""`);
      lines.push(``);
      lines.push(`    def test_happy_path_shape(self):`);
      lines.push(`        response = httpx.${p.method.toLowerCase()}(f"{BASE_URL}${this.exampleUrl(p.path)}")`);
      lines.push(`        assert response.status_code in (200, 201, 204)`);
      lines.push(`        # TODO: validate shape with a pydantic model`);
      lines.push(`        # body = response.json()`);
      lines.push(`        # Schema(**body)`);
      lines.push(`        pytest.fail("Not implemented — add pydantic schema validation")`);
      lines.push(``);
    }
    if (providers.length === 0) {
      lines.push(`def test_placeholder():`);
      lines.push(`    pytest.fail("No providers detected in LLD pseudo-files.")`);
    }
    return lines.join('\n') + '\n';
  }

  private renderConsumerTestsPy(pairs: MatchedPair[]): string {
    const lines: string[] = [
      `# AUTO-GENERATED by BA Tool (D2 — Contract Test Scaffold)`,
      `# Consumer-side contract tests. Uses respx to mock the provider and`,
      `# verify the consumer correctly handles the documented shape.`,
      ``,
      `import pytest`,
      `import respx`,
      `import httpx`,
      ``,
    ];
    for (const pair of pairs) {
      if (pair.consumers.length === 0) continue;
      const testName = this.pyTestName(pair.method, pair.path);
      lines.push(`@respx.mock`);
      lines.push(`def test_consumer_${testName.toLowerCase()}():`);
      lines.push(`    """Consumer expects ${pair.method} ${pair.path} to return the documented shape."""`);
      for (const c of pair.consumers.slice(0, 3)) {
        lines.push(`    # consumer callsite: ${c.sourceFile}`);
      }
      lines.push(`    respx.${pair.method.toLowerCase()}("${this.exampleFullUrl(pair.path)}").mock(`);
      lines.push(`        return_value=httpx.Response(200, json={"ok": True}),`);
      lines.push(`    )`);
      lines.push(`    # TODO: invoke the real consumer function and assert`);
      lines.push(`    pytest.fail("Not implemented — wire the real consumer into this test")`);
      lines.push(``);
    }
    if (!pairs.some((p) => p.consumers.length > 0)) {
      lines.push(`def test_placeholder():`);
      lines.push(`    pytest.fail("No consumer calls detected in LLD pseudo-files.")`);
    }
    return lines.join('\n') + '\n';
  }

  private pyTestName(method: HttpMethod, path: string): string {
    const seg = path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `${method.toLowerCase()}_${seg || 'root'}`
      .replace(/_+/g, '_')
      .replace(/(^|_)(\w)/g, (_m, _p1, p2) => p2.toUpperCase());
  }

  private exampleUrl(p: string): string {
    return p.replace(/:([a-zA-Z_]\w*)/g, '1'); // substitute any :param with "1"
  }

  private exampleFullUrl(p: string): string {
    return `http://localhost:4000${this.exampleUrl(p)}`;
  }

  private mswPath(p: string): string {
    return `*${p.replace(/:([a-zA-Z_]\w*)/g, ':$1')}`;
  }

  // ─── README + config files ──────────────────────────────────────────────

  private buildReadme(
    artifact: { artifactId: string; module: { moduleId: string; moduleName: string } },
    pairs: MatchedPair[],
    endpoints: Endpoint[],
  ): string {
    const matched = pairs.filter((p) => p.provider && p.consumers.length > 0);
    const providersOnly = pairs.filter((p) => p.provider && p.consumers.length === 0);
    const orphanConsumers = pairs.filter((p) => !p.provider && p.consumers.length > 0);

    const lines: string[] = [
      `# Contract Test Scaffold — ${artifact.artifactId}`,
      ``,
      `Module: **${artifact.module.moduleId} — ${artifact.module.moduleName}**`,
      ``,
      `Scanned **${endpoints.length}** endpoint reference(s) across the LLD's pseudo-files.`,
      ``,
      `## Contract summary`,
      ``,
      `| Category | Count |`,
      `|---|---|`,
      `| Matched (provider + consumer) | **${matched.length}** |`,
      `| Provider only — no consumer detected | ${providersOnly.length} |`,
      `| Orphan consumer — no provider detected | **${orphanConsumers.length}** ⚠ |`,
      ``,
    ];
    if (orphanConsumers.length > 0) {
      lines.push(`### ⚠ Orphan consumers (will likely break integration)`);
      lines.push(``);
      for (const p of orphanConsumers) {
        lines.push(`- \`${p.method} ${p.path}\` — ${p.consumers.length} consumer callsite(s)`);
        for (const c of p.consumers) lines.push(`  - in \`${c.sourceFile}\``);
      }
      lines.push(``);
    }
    if (matched.length > 0) {
      lines.push(`### Matched contracts`);
      lines.push(``);
      for (const p of matched) {
        lines.push(`- \`${p.method} ${p.path}\` — provider: \`${p.provider!.sourceFile}\`, ${p.consumers.length} consumer(s)`);
      }
      lines.push(``);
    }
    lines.push(`## How to run`);
    lines.push('');
    lines.push(`### JavaScript / TypeScript (Jest + msw)`);
    lines.push('```bash');
    lines.push(`cd javascript`);
    lines.push(`npm install`);
    lines.push(`CONTRACT_BASE_URL=http://localhost:4000 npm test`);
    lines.push('```');
    lines.push('');
    lines.push(`### Python (pytest + httpx + respx)`);
    lines.push('```bash');
    lines.push(`cd python`);
    lines.push(`pip install -r requirements.txt`);
    lines.push(`CONTRACT_BASE_URL=http://localhost:4000 pytest`);
    lines.push('```');
    lines.push('');
    lines.push(`## Files`);
    lines.push('');
    lines.push(`- \`openapi.yaml\` — OpenAPI 3.0 stub for every detected path`);
    lines.push(`- \`javascript/contracts/providers.test.ts\` — Jest+supertest provider shape assertions`);
    lines.push(`- \`javascript/contracts/consumers.test.ts\` — Jest+msw pact-style consumer tests`);
    lines.push(`- \`python/contracts/test_providers.py\` — pytest+httpx provider shape assertions`);
    lines.push(`- \`python/contracts/test_consumers.py\` — pytest+respx consumer tests`);
    if (orphanConsumers.length > 0) {
      lines.push(`- \`UNRESOLVED_CONTRACTS.md\` — list of orphan consumers needing a provider`);
    }
    lines.push('');
    lines.push(`---`);
    lines.push(`Generated by BA Tool · regex-grade pseudo-code parsing.`);
    return lines.join('\n') + '\n';
  }

  private buildOrphansReport(orphans: MatchedPair[]): string {
    const lines: string[] = [
      `# Unresolved Contracts`,
      ``,
      `These consumer callsites reference endpoints that no provider in this LLD implements.`,
      `Either:`,
      `  1. The provider lives in another module/service (ensure it ships the documented shape)`,
      `  2. The endpoint is deprecated on the provider side (remove the consumer)`,
      `  3. The LLD is incomplete (add the provider)`,
      ``,
    ];
    for (const p of orphans) {
      lines.push(`## ${p.method} ${p.path}`);
      lines.push(``);
      for (const c of p.consumers) {
        lines.push(`- \`${c.sourceFile}\``);
      }
      lines.push(``);
    }
    return lines.join('\n');
  }

  private jsPackageJson(artifactId: string): string {
    return JSON.stringify(
      {
        name: `${artifactId.toLowerCase()}-contract-tests`,
        version: '0.0.1',
        private: true,
        scripts: { test: 'jest' },
        devDependencies: {
          jest: '^29.7.0',
          'ts-jest': '^29.2.5',
          '@types/jest': '^29.5.13',
          typescript: '^5.6.3',
          supertest: '^7.0.0',
          '@types/supertest': '^6.0.2',
          msw: '^2.6.0',
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
  roots: ['<rootDir>/contracts'],
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
        include: ['contracts/**/*'],
      },
      null,
      2,
    ) + '\n';
  }
  private pythonRequirements(): string {
    return 'pytest==8.3.3\nhttpx==0.27.2\nrespx==0.21.1\npydantic==2.9.2\n';
  }
  private pythonPytestIni(): string {
    return `[pytest]\ntestpaths = contracts\npython_files = test_*.py\n`;
  }
}
