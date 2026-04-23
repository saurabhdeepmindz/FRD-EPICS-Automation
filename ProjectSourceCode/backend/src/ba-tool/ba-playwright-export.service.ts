import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Playwright test-suite generator. Takes an FTC artifact and emits a ZIP that
 * a developer can extract, `npm install`, and run with `npx playwright test`.
 *
 * Deterministic template codegen — no AI call. Each TC's playwrightHint is
 * wrapped in a `test(...)` block inside a spec file named after the
 * scenarioGroup; TCs without a hint are emitted as `test.skip(...)` with a
 * TODO comment pointing the developer at the TC id.
 *
 * Produced layout:
 *
 *   playwright-suite-<artifactId>/
 *   ├── playwright.config.ts
 *   ├── package.json
 *   ├── README.md
 *   ├── .env.example
 *   ├── .gitignore
 *   └── tests/
 *       ├── fixtures/
 *       │   ├── auth.fixture.ts
 *       │   └── db.fixture.ts
 *       ├── sql/
 *       │   ├── setup.sql
 *       │   └── verify.sql
 *       └── <scenarioGroup>.spec.ts × N
 */
@Injectable()
export class BaPlaywrightExportService {
  private readonly logger = new Logger(BaPlaywrightExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildZip(ftcArtifactDbId: string): Promise<{ buffer: Buffer; filename: string }> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: ftcArtifactDbId },
      include: {
        testCases: { orderBy: [{ scenarioGroup: 'asc' }, { testCaseId: 'asc' }] },
      },
    });
    if (!artifact) throw new NotFoundException(`FTC artifact ${ftcArtifactDbId} not found`);
    if (artifact.artifactType !== 'FTC') {
      throw new NotFoundException(`Artifact ${ftcArtifactDbId} is not an FTC artifact`);
    }

    const zip = new AdmZip();
    const safeId = artifact.artifactId.replace(/[^a-zA-Z0-9._-]/g, '_');
    const root = `playwright-suite-${safeId}`;

    // ─── Root files ───
    zip.addFile(`${root}/playwright.config.ts`, Buffer.from(this.playwrightConfig(), 'utf-8'));
    zip.addFile(`${root}/package.json`, Buffer.from(this.packageJson(safeId), 'utf-8'));
    zip.addFile(`${root}/README.md`, Buffer.from(this.readme(artifact.artifactId, artifact.testCases.length), 'utf-8'));
    zip.addFile(`${root}/.env.example`, Buffer.from(this.envExample(), 'utf-8'));
    zip.addFile(`${root}/.gitignore`, Buffer.from(this.gitignore(), 'utf-8'));

    // ─── Fixtures ───
    zip.addFile(`${root}/tests/fixtures/auth.fixture.ts`, Buffer.from(this.authFixture(), 'utf-8'));
    zip.addFile(`${root}/tests/fixtures/db.fixture.ts`, Buffer.from(this.dbFixture(), 'utf-8'));

    // ─── SQL (concat of all TC SQL setups + verifies) ───
    const sqlSetupParts: string[] = ['-- Auto-generated test-data setup from FTC artifact ' + artifact.artifactId];
    const sqlVerifyParts: string[] = ['-- Auto-generated post-test verification queries from FTC artifact ' + artifact.artifactId];
    for (const tc of artifact.testCases) {
      if (tc.sqlSetup?.trim()) {
        sqlSetupParts.push(`\n-- ${tc.testCaseId}: ${tc.title}\n${tc.sqlSetup.trim()}`);
      }
      if (tc.sqlVerify?.trim()) {
        sqlVerifyParts.push(`\n-- ${tc.testCaseId}: ${tc.title}\n${tc.sqlVerify.trim()}`);
      }
    }
    zip.addFile(`${root}/tests/sql/setup.sql`, Buffer.from(sqlSetupParts.join('\n') + '\n', 'utf-8'));
    zip.addFile(`${root}/tests/sql/verify.sql`, Buffer.from(sqlVerifyParts.join('\n') + '\n', 'utf-8'));

    // ─── Spec files — one per scenarioGroup ───
    const byGroup = new Map<string, typeof artifact.testCases>();
    for (const tc of artifact.testCases) {
      const group = tc.scenarioGroup?.trim() || 'Ungrouped';
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push(tc);
    }
    for (const [groupName, tcs] of byGroup) {
      const slug = this.slugify(groupName);
      const specContent = this.specFile(groupName, tcs);
      zip.addFile(`${root}/tests/${slug}.spec.ts`, Buffer.from(specContent, 'utf-8'));
    }

    const buffer = zip.toBuffer();
    const filename = `${root}.zip`;
    this.logger.log(`Playwright export: built ${filename} with ${artifact.testCases.length} TCs across ${byGroup.size} scenario groups`);
    return { buffer, filename };
  }

  // ─── Template generators ────────────────────────────────────────────────

  private playwrightConfig(): string {
    return `import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config auto-generated from FTC artifact.
 * Adjust baseURL + auth state path to match your environment.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  ],
});
`;
  }

  private packageJson(safeId: string): string {
    return JSON.stringify({
      name: `playwright-suite-${safeId.toLowerCase()}`,
      version: '0.1.0',
      private: true,
      scripts: {
        test: 'playwright test',
        'test:headed': 'playwright test --headed',
        'test:ui': 'playwright test --ui',
        report: 'playwright show-report',
      },
      devDependencies: {
        '@playwright/test': '^1.48.0',
        typescript: '^5.4.0',
      },
    }, null, 2) + '\n';
  }

  private readme(artifactId: string, tcCount: number): string {
    return `# Playwright Suite — ${artifactId}

Auto-generated Playwright test suite from the AI FTC Workbench.
Covers ${tcCount} test case${tcCount === 1 ? '' : 's'}.

## Getting started

\`\`\`bash
npm install
npx playwright install
cp .env.example .env
# edit .env to point BASE_URL at your environment

# Seed test data (optional — run against your test DB)
psql "$TEST_DB_URL" -f tests/sql/setup.sql

npm test
# or: npx playwright test --ui

# After the run, verify post-conditions
psql "$TEST_DB_URL" -f tests/sql/verify.sql
\`\`\`

## What's inside

- \`playwright.config.ts\` — base config, Chromium + Firefox projects
- \`tests/fixtures/auth.fixture.ts\` — storage-state login helper (stub)
- \`tests/fixtures/db.fixture.ts\` — sql/setup + sql/verify hooks
- \`tests/sql/\` — consolidated test-data setup + verification scripts
- \`tests/*.spec.ts\` — one spec file per scenario group; each test maps 1:1 to a TC

## What needs human polish

- Fill in real selectors where TCs have placeholder hints
- Wire \`auth.fixture.ts\` to your actual login flow
- Set \`TEST_DB_URL\` if SQL fixtures should run
- Check \`test.skip\` blocks (TCs without a Playwright hint) and either add
  a hint to the FTC or delete the skipped test if it's backend-only

## CI

\`\`\`yaml
# .github/workflows/playwright.yml (example)
name: playwright
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: playwright-report/ }
\`\`\`
`;
  }

  private envExample(): string {
    return `# Playwright suite environment variables — copy to .env and fill in

# Base URL of the application under test
BASE_URL=http://localhost:3000

# Auth credentials used by tests/fixtures/auth.fixture.ts
TEST_USER_EMAIL=
TEST_USER_PASSWORD=

# Optional: database URL for SQL setup/verify scripts
TEST_DB_URL=
`;
  }

  private gitignore(): string {
    return `node_modules/
playwright-report/
test-results/
.env
*.log
`;
  }

  private authFixture(): string {
    return `import { test as base, type Page } from '@playwright/test';

/**
 * Auth fixture stub. Replace the body of \`authedPage\` with your real
 * login flow, or swap to Playwright's storageState pattern for speed.
 */
type AuthFixtures = { authedPage: Page };

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD must be set in .env');
    }
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\\/dashboard|\\/home/);
    await use(page);
  },
});

export { expect } from '@playwright/test';
`;
  }

  private dbFixture(): string {
    return `/**
 * Thin DB helper — invoke tests/sql/setup.sql before the suite and
 * tests/sql/verify.sql after. By default we shell out to psql; swap in
 * your preferred client (pg, mysql2, better-sqlite3, etc.).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SETUP = resolve(__dirname, '../sql/setup.sql');
const VERIFY = resolve(__dirname, '../sql/verify.sql');

function run(scriptPath: string): void {
  const url = process.env.TEST_DB_URL;
  if (!url || !existsSync(scriptPath)) return;
  execSync(\`psql \${JSON.stringify(url)} -f \${JSON.stringify(scriptPath)}\`, { stdio: 'inherit' });
}

export function seedTestData(): void { run(SETUP); }
export function verifyTestData(): void { run(VERIFY); }
`;
  }

  /** Build one scenario-group spec file. */
  private specFile(
    groupName: string,
    tcs: Array<{
      testCaseId: string;
      title: string;
      testKind: string;
      scope: string;
      category: string | null;
      owaspCategory: string | null;
      preconditions: string | null;
      testData: string | null;
      steps: string;
      expected: string;
      postValidation: string | null;
      playwrightHint: string | null;
      linkedFeatureIds: string[];
      linkedEpicIds: string[];
      linkedStoryIds: string[];
      linkedSubtaskIds: string[];
      tags: string[];
    }>,
  ): string {
    const out: string[] = [];
    out.push(`import { test, expect } from '@playwright/test';`);
    out.push('');
    out.push(`/**`);
    out.push(` * Scenario group: ${this.escapeBlockComment(groupName)}`);
    out.push(` * Auto-generated from FTC artifact. See ../README.md for setup.`);
    out.push(` */`);
    out.push('');
    out.push(`test.describe('${this.escapeStringLit(groupName)}', () => {`);

    for (const tc of tcs) {
      out.push('');
      // Block comment with traceability + metadata
      out.push('  /**');
      out.push(`   * ${tc.testCaseId} — ${this.escapeBlockComment(tc.title)}`);
      const tracePieces = [
        tc.linkedFeatureIds.length > 0 ? `Features: ${tc.linkedFeatureIds.join(', ')}` : null,
        tc.linkedEpicIds.length > 0 ? `EPICs: ${tc.linkedEpicIds.join(', ')}` : null,
        tc.linkedStoryIds.length > 0 ? `Stories: ${tc.linkedStoryIds.join(', ')}` : null,
        tc.linkedSubtaskIds.length > 0 ? `SubTasks: ${tc.linkedSubtaskIds.slice(0, 3).join(', ')}${tc.linkedSubtaskIds.length > 3 ? ` (+${tc.linkedSubtaskIds.length - 3})` : ''}` : null,
      ].filter((x): x is string => !!x);
      for (const p of tracePieces) out.push(`   * ${p}`);
      out.push(`   * Kind: ${tc.testKind} · Scope: ${tc.scope}${tc.category ? ` · Category: ${tc.category}` : ''}${tc.owaspCategory ? ` · OWASP: ${tc.owaspCategory}` : ''}`);
      if (tc.tags.length > 0) out.push(`   * Tags: ${tc.tags.join(', ')}`);
      if (tc.testData?.trim()) {
        out.push('   *');
        out.push('   * Test Data:');
        for (const dataLine of tc.testData.split('\n')) out.push(`   *   ${this.escapeBlockComment(dataLine)}`);
      }
      if (tc.preconditions?.trim()) {
        out.push('   *');
        out.push('   * Preconditions:');
        for (const pc of tc.preconditions.split('\n')) out.push(`   *   ${this.escapeBlockComment(pc)}`);
      }
      if (tc.expected?.trim()) {
        out.push('   *');
        out.push('   * Expected:');
        for (const ex of tc.expected.split('\n')) out.push(`   *   ${this.escapeBlockComment(ex)}`);
      }
      if (tc.postValidation?.trim()) {
        out.push('   *');
        out.push('   * Post-validation (verify via tests/sql/verify.sql or manually):');
        for (const pv of tc.postValidation.split('\n')) out.push(`   *   ${this.escapeBlockComment(pv)}`);
      }
      out.push('   */');

      const hasHint = tc.playwrightHint && tc.playwrightHint.trim().length > 0;
      const testName = `${tc.testCaseId}: ${tc.title}`;
      const isSkip = !hasHint;

      if (isSkip) {
        out.push(`  test.skip('${this.escapeStringLit(testName)}', async ({ page }) => {`);
        out.push(`    // TODO: add a Playwright Hint to this TC in the FTC workbench, then regenerate the suite.`);
        out.push(`    // Steps (for reference):`);
        for (const s of tc.steps.split('\n')) out.push(`    //   ${this.escapeLineComment(s)}`);
        out.push(`  });`);
      } else {
        out.push(`  test('${this.escapeStringLit(testName)}', async ({ page }) => {`);
        // Indent the hint body 4 spaces
        const hintLines = tc.playwrightHint!.split('\n');
        for (const line of hintLines) out.push(line ? `    ${line}` : '');
        out.push(`  });`);
      }
    }

    out.push('});');
    out.push('');
    return out.join('\n');
  }

  // ─── Escaping helpers ───────────────────────────────────────────────────

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'scenario';
  }

  private escapeStringLit(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private escapeBlockComment(s: string): string {
    return s.replace(/\*\//g, '* /');
  }

  private escapeLineComment(s: string): string {
    return s.replace(/[\r\n]+/g, ' ');
  }
}
