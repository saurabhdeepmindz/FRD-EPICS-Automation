/**
 * Task 4 — Python FastAPI AI service structural test
 * Verifies all required files exist and contain correct content.
 * Run: node --test tests/task4-ai-service-scaffold.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AI = join(__dirname, '..', 'ai-service');

function assertExists(rel, label) {
  assert.ok(existsSync(join(AI, rel)), `MISSING: ${label} (${rel})`);
}

function assertContains(rel, str, label) {
  const content = readFileSync(join(AI, rel), 'utf8');
  assert.ok(content.includes(str), `${rel} should contain "${str}" (${label})`);
}

describe('Task 4 — Python FastAPI AI service scaffold', () => {

  describe('Core files', () => {
    test('main.py exists',                    () => assertExists('main.py', 'main.py'));
    test('config.py exists',                  () => assertExists('config.py', 'config.py'));
    test('requirements.txt exists',           () => assertExists('requirements.txt', 'requirements.txt'));
    test('.env.example exists',               () => assertExists('.env.example', '.env.example'));
    test('Dockerfile exists',                 () => assertExists('Dockerfile', 'Dockerfile'));
  });

  describe('Prompts module', () => {
    test('prompts/__init__.py exists',        () => assertExists('prompts/__init__.py', 'prompts/__init__.py'));
    test('prompts/section_prompts.py exists', () => assertExists('prompts/section_prompts.py', 'prompts/section_prompts.py'));
  });

  describe('Tests', () => {
    test('tests/__init__.py exists',          () => assertExists('tests/__init__.py', 'tests/__init__.py'));
    test('tests/test_suggest.py exists',      () => assertExists('tests/test_suggest.py', 'tests/test_suggest.py'));
  });

  describe('main.py — API structure', () => {
    test('FastAPI app defined',               () => assertContains('main.py', 'FastAPI', 'FastAPI instance'));
    test('POST /suggest endpoint exists',     () => assertContains('main.py', '/suggest', 'suggest route'));
    test('GET /health endpoint exists',       () => assertContains('main.py', '/health', 'health route'));
    test('CORS middleware configured',        () => assertContains('main.py', 'CORSMiddleware', 'CORS middleware'));
    test('OpenAI client used',                () => assertContains('main.py', 'openai', 'openai import'));
  });

  describe('config.py — settings', () => {
    test('OPENAI_API_KEY loaded from env',    () => assertContains('config.py', 'OPENAI_API_KEY', 'API key from env'));
    test('OPENAI_MODEL configurable',         () => assertContains('config.py', 'OPENAI_MODEL', 'model from env'));
    test('No hardcoded API key value',        () => {
      const content = readFileSync(join(AI, 'config.py'), 'utf8');
      assert.ok(!content.includes('sk-'), 'hardcoded sk- API key found in config.py');
    });
  });

  describe('section_prompts.py — prompt templates', () => {
    test('SECTION_PROMPTS dict defined',      () => assertContains('prompts/section_prompts.py', 'SECTION_PROMPTS', 'prompts dict'));
    test('Covers all 22 sections (keys 1-22)',() => {
      const content = readFileSync(join(AI, 'prompts/section_prompts.py'), 'utf8');
      for (let i = 1; i <= 22; i++) {
        assert.ok(content.includes(`${i}:`), `Missing section ${i} prompt key`);
      }
    });
    test('DEFAULT_PROMPT fallback defined',   () => assertContains('prompts/section_prompts.py', 'DEFAULT_PROMPT', 'default prompt'));
  });

  describe('requirements.txt — dependencies', () => {
    test('fastapi listed',                    () => assertContains('requirements.txt', 'fastapi', 'fastapi dep'));
    test('uvicorn listed',                    () => assertContains('requirements.txt', 'uvicorn', 'uvicorn dep'));
    test('openai listed',                     () => assertContains('requirements.txt', 'openai', 'openai dep'));
    test('pydantic listed',                   () => assertContains('requirements.txt', 'pydantic', 'pydantic dep'));
    test('pytest listed',                     () => assertContains('requirements.txt', 'pytest', 'pytest dep'));
  });

  describe('.env.example — security', () => {
    test('OPENAI_API_KEY placeholder present',() => assertContains('.env.example', 'OPENAI_API_KEY', 'key placeholder'));
    test('placeholder is NOT a real key',     () => {
      const content = readFileSync(join(AI, '.env.example'), 'utf8');
      assert.ok(!content.match(/sk-[A-Za-z0-9]{20,}/), 'real API key found in .env.example');
    });
  });

});
