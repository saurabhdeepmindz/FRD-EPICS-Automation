/**
 * Task 3 — NestJS backend scaffold structural test
 * Verifies all required files exist and contain correct content.
 * Run: node --test tests/task3-backend-scaffold.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BE = join(__dirname, '..', 'backend');

function assertExists(rel, label) {
  assert.ok(existsSync(join(BE, rel)), `MISSING: ${label} (${rel})`);
}

function assertContains(rel, str, label) {
  const content = readFileSync(join(BE, rel), 'utf8');
  assert.ok(content.includes(str), `${rel} should contain "${str}" (${label})`);
}

describe('Task 3 — NestJS backend scaffold', () => {

  describe('Entry point & core modules', () => {
    test('src/main.ts exists',        () => assertExists('src/main.ts', 'main.ts'));
    test('src/app.module.ts exists',  () => assertExists('src/app.module.ts', 'app.module.ts'));
    test('src/app.controller.ts exists', () => assertExists('src/app.controller.ts', 'app.controller.ts'));
    test('src/app.service.ts exists', () => assertExists('src/app.service.ts', 'app.service.ts'));
  });

  describe('main.ts configuration', () => {
    test('main.ts listens on PORT env var',    () => assertContains('src/main.ts', 'PORT', 'PORT env'));
    test('main.ts enables CORS',               () => assertContains('src/main.ts', 'enableCors', 'CORS'));
    test('main.ts enables ValidationPipe',     () => assertContains('src/main.ts', 'ValidationPipe', 'ValidationPipe'));
    test('main.ts sets global prefix /api',    () => assertContains('src/main.ts', '/api', 'global prefix'));
  });

  describe('Health endpoint', () => {
    test('app.controller.ts has /health route', () => assertContains('src/app.controller.ts', 'health', 'health route'));
    test('app.service.ts returns status ok',    () => assertContains('src/app.service.ts', 'ok', 'status ok'));
  });

  describe('Prisma setup', () => {
    test('prisma/schema.prisma exists',            () => assertExists('prisma/schema.prisma', 'schema.prisma'));
    test('src/prisma/prisma.service.ts exists',    () => assertExists('src/prisma/prisma.service.ts', 'prisma.service.ts'));
    test('src/prisma/prisma.module.ts exists',     () => assertExists('src/prisma/prisma.module.ts', 'prisma.module.ts'));
    test('schema.prisma has postgresql provider',  () => assertContains('prisma/schema.prisma', 'postgresql', 'postgresql provider'));
    test('schema.prisma defines Prd model',        () => assertContains('prisma/schema.prisma', 'model Prd', 'Prd model'));
    test('schema.prisma defines PrdSection model', () => assertContains('prisma/schema.prisma', 'model PrdSection', 'PrdSection model'));
    test('prisma.service.ts extends PrismaClient', () => assertContains('src/prisma/prisma.service.ts', 'PrismaClient', 'PrismaClient'));
  });

  describe('NestJS tsconfig and nest-cli', () => {
    test('tsconfig.json exists',      () => assertExists('tsconfig.json', 'tsconfig.json'));
    test('nest-cli.json exists',      () => assertExists('nest-cli.json', 'nest-cli.json'));
    test('tsconfig uses emitDecoratorMetadata', () =>
      assertContains('tsconfig.json', 'emitDecoratorMetadata', 'decorator metadata'));
  });

  describe('Environment & security', () => {
    test('.env.example exists',                  () => assertExists('.env.example', '.env.example'));
    test('.env.example has DATABASE_URL',        () => assertContains('.env.example', 'DATABASE_URL', 'DATABASE_URL'));
    test('.env.example has AI_SERVICE_URL',      () => assertContains('.env.example', 'AI_SERVICE_URL', 'AI_SERVICE_URL'));
    test('.env.example has CORS_ORIGINS',        () => assertContains('.env.example', 'CORS_ORIGINS', 'CORS_ORIGINS'));
    test('main.ts does NOT hardcode db password',() => {
      const content = readFileSync(join(BE, 'src/main.ts'), 'utf8');
      assert.ok(!content.includes('prd_secret'), 'hardcoded password found in main.ts');
    });
  });

});
