/**
 * Task 1 — Structural validation test
 * Verifies that all required monorepo files and directories exist.
 * Run: node --test tests/task1-structure.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function assertExists(relPath, label) {
  const full = join(ROOT, relPath);
  assert.ok(existsSync(full), `MISSING: ${label} (${relPath})`);
}

describe('Task 1 — Monorepo structure', () => {

  describe('Top-level files', () => {
    test('docker-compose.yml exists', () => assertExists('docker-compose.yml', 'docker-compose.yml'));
    test('README.md exists',          () => assertExists('README.md', 'README.md'));
    test('.gitignore exists',          () => assertExists('.gitignore', '.gitignore'));
  });

  describe('frontend/ directory', () => {
    test('frontend/ exists',                  () => assertExists('frontend', 'frontend/'));
    test('frontend/package.json exists',      () => assertExists('frontend/package.json', 'frontend/package.json'));
    test('frontend/Dockerfile exists',        () => assertExists('frontend/Dockerfile', 'frontend/Dockerfile'));
    test('frontend/.env.example exists',      () => assertExists('frontend/.env.example', 'frontend/.env.example'));
  });

  describe('backend/ directory', () => {
    test('backend/ exists',               () => assertExists('backend', 'backend/'));
    test('backend/package.json exists',   () => assertExists('backend/package.json', 'backend/package.json'));
    test('backend/Dockerfile exists',     () => assertExists('backend/Dockerfile', 'backend/Dockerfile'));
    test('backend/.env.example exists',   () => assertExists('backend/.env.example', 'backend/.env.example'));
  });

  describe('ai-service/ directory', () => {
    test('ai-service/ exists',                    () => assertExists('ai-service', 'ai-service/'));
    test('ai-service/requirements.txt exists',    () => assertExists('ai-service/requirements.txt', 'ai-service/requirements.txt'));
    test('ai-service/Dockerfile exists',          () => assertExists('ai-service/Dockerfile', 'ai-service/Dockerfile'));
    test('ai-service/.env.example exists',        () => assertExists('ai-service/.env.example', 'ai-service/.env.example'));
  });

  describe('docker-compose service definitions', () => {
    test('docker-compose.yml references frontend, backend, ai-service, and db', async () => {
      const { readFileSync } = await import('node:fs');
      const content = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8');
      assert.ok(content.includes('frontend'),   'docker-compose missing frontend service');
      assert.ok(content.includes('backend'),    'docker-compose missing backend service');
      assert.ok(content.includes('ai-service'), 'docker-compose missing ai-service service');
      assert.ok(content.includes('postgres'),   'docker-compose missing postgres service');
    });
  });

});
