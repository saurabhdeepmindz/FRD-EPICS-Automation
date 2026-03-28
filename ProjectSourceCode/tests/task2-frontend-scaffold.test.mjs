/**
 * Task 2 — Frontend scaffold structural test
 * Verifies all required Next.js / Tailwind / shadcn files exist and have correct content.
 * Run: node --test tests/task2-frontend-scaffold.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FE = join(__dirname, '..', 'frontend');

function assertExists(rel, label) {
  assert.ok(existsSync(join(FE, rel)), `MISSING: ${label}`);
}

function assertContains(rel, str, label) {
  const content = readFileSync(join(FE, rel), 'utf8');
  assert.ok(content.includes(str), `${rel} should contain "${str}" (${label})`);
}

describe('Task 2 — Next.js frontend scaffold', () => {

  describe('Config files', () => {
    test('next.config.ts exists',      () => assertExists('next.config.ts', 'next.config.ts'));
    test('tailwind.config.ts exists',  () => assertExists('tailwind.config.ts', 'tailwind.config.ts'));
    test('postcss.config.mjs exists',  () => assertExists('postcss.config.mjs', 'postcss.config.mjs'));
    test('tsconfig.json exists',       () => assertExists('tsconfig.json', 'tsconfig.json'));
    test('components.json exists',     () => assertExists('components.json', 'components.json'));
  });

  describe('App Router structure', () => {
    test('app/layout.tsx exists',  () => assertExists('app/layout.tsx', 'app/layout.tsx'));
    test('app/page.tsx exists',    () => assertExists('app/page.tsx', 'app/page.tsx'));
    test('app/globals.css exists', () => assertExists('app/globals.css', 'app/globals.css'));
  });

  describe('Tailwind config content', () => {
    test('tailwind.config.ts includes content paths', () =>
      assertContains('tailwind.config.ts', 'content', 'content array for purging'));
    test('tailwind.config.ts references app directory', () =>
      assertContains('tailwind.config.ts', './app', 'app dir content path'));
    test('tailwind.config.ts references components directory', () =>
      assertContains('tailwind.config.ts', './components', 'components dir content path'));
  });

  describe('globals.css — Tailwind directives', () => {
    test('@tailwind base present',       () => assertContains('app/globals.css', '@tailwind base', 'base layer'));
    test('@tailwind components present', () => assertContains('app/globals.css', '@tailwind components', 'components layer'));
    test('@tailwind utilities present',  () => assertContains('app/globals.css', '@tailwind utilities', 'utilities layer'));
  });

  describe('layout.tsx — app shell', () => {
    test('layout imports globals.css',   () => assertContains('app/layout.tsx', 'globals.css', 'globals import'));
    test('layout exports RootLayout',    () => assertContains('app/layout.tsx', 'RootLayout', 'RootLayout export'));
    test('layout has html+body',         () => assertContains('app/layout.tsx', '<html', 'html tag'));
  });

  describe('shadcn/ui components', () => {
    test('components/ui/ directory exists', () => assertExists('components/ui', 'components/ui/'));
    test('components/ui/button.tsx exists', () => assertExists('components/ui/button.tsx', 'Button component'));
    test('components/ui/card.tsx exists',   () => assertExists('components/ui/card.tsx', 'Card component'));
    test('Button uses cva or cn',           () => assertContains('components/ui/button.tsx', 'cva', 'cva for variants'));
    test('Card exports CardHeader',         () => assertContains('components/ui/card.tsx', 'CardHeader', 'CardHeader export'));
  });

  describe('lib utilities', () => {
    test('lib/utils.ts exists',    () => assertExists('lib/utils.ts', 'lib/utils.ts'));
    test('lib/utils.ts exports cn', () => assertContains('lib/utils.ts', 'export function cn', 'cn utility'));
  });

  describe('page.tsx — landing page', () => {
    test('page.tsx has data-testid="home-page"', () =>
      assertContains('app/page.tsx', 'data-testid="home-page"', 'testid for playwright'));
    test('page.tsx renders heading',             () =>
      assertContains('app/page.tsx', 'PRD Generator', 'product name on landing'));
  });

});
