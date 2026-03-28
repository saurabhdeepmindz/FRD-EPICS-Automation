/**
 * Task 5 — PRD CRUD API structural test
 * Verifies all required NestJS PRD module files exist with correct content.
 * Run: node --test tests/task5-prd-crud-api.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BE = join(__dirname, '..', 'backend', 'src');

function assertExists(rel, label) {
  assert.ok(existsSync(join(BE, rel)), `MISSING: ${label} (${rel})`);
}

function assertContains(rel, str, label) {
  const content = readFileSync(join(BE, rel), 'utf8');
  assert.ok(content.includes(str), `${rel} should contain "${str}" (${label})`);
}

describe('Task 5 — PRD CRUD API', () => {

  describe('Module files exist', () => {
    test('prd/prd.module.ts',            () => assertExists('prd/prd.module.ts', 'prd.module.ts'));
    test('prd/prd.controller.ts',        () => assertExists('prd/prd.controller.ts', 'prd.controller.ts'));
    test('prd/prd.service.ts',           () => assertExists('prd/prd.service.ts', 'prd.service.ts'));
    test('prd/dto/create-prd.dto.ts',    () => assertExists('prd/dto/create-prd.dto.ts', 'create-prd.dto.ts'));
    test('prd/dto/update-section.dto.ts',() => assertExists('prd/dto/update-section.dto.ts', 'update-section.dto.ts'));
  });

  describe('prd.controller.ts — routes', () => {
    test('POST /prd endpoint',            () => assertContains('prd/prd.controller.ts', 'Post()', 'POST create'));
    test('GET /prd list endpoint',        () => assertContains('prd/prd.controller.ts', "Get()", 'GET list'));
    test('GET /prd/:id endpoint',         () => assertContains('prd/prd.controller.ts', 'Get(\':id\')', 'GET by id'));
    test('PUT /prd/:id/section/:num',     () => assertContains('prd/prd.controller.ts', 'sectionNumber', 'section update'));
    test('GET /prd/:id/completion',       () => assertContains('prd/prd.controller.ts', 'completion', 'completion route'));
    test('DELETE /prd/:id endpoint',      () => assertContains('prd/prd.controller.ts', 'Delete(\':id\')', 'DELETE'));
  });

  describe('prd.service.ts — business logic', () => {
    test('create() method',              () => assertContains('prd/prd.service.ts', 'async create', 'create method'));
    test('findAll() method',             () => assertContains('prd/prd.service.ts', 'async findAll', 'findAll method'));
    test('findOne() method',             () => assertContains('prd/prd.service.ts', 'async findOne', 'findOne method'));
    test('updateSection() method',       () => assertContains('prd/prd.service.ts', 'async updateSection', 'updateSection method'));
    test('getCompletion() method',       () => assertContains('prd/prd.service.ts', 'async getCompletion', 'getCompletion method'));
    test('remove() method',              () => assertContains('prd/prd.service.ts', 'async remove', 'remove method'));
    test('Uses PrismaService',           () => assertContains('prd/prd.service.ts', 'PrismaService', 'Prisma injected'));
    test('Throws NotFoundException',     () => assertContains('prd/prd.service.ts', 'NotFoundException', '404 on missing'));
  });

  describe('create-prd.dto.ts — validation', () => {
    test('productName IsString',         () => assertContains('prd/dto/create-prd.dto.ts', 'IsString', 'IsString decorator'));
    test('productName IsNotEmpty',       () => assertContains('prd/dto/create-prd.dto.ts', 'IsNotEmpty', 'IsNotEmpty decorator'));
    test('prdCode field',                () => assertContains('prd/dto/create-prd.dto.ts', 'prdCode', 'prdCode field'));
  });

  describe('update-section.dto.ts — validation', () => {
    test('content field',                () => assertContains('prd/dto/update-section.dto.ts', 'content', 'content field'));
    test('IsObject or IsNotEmpty',       () => assertContains('prd/dto/update-section.dto.ts', 'IsObject', 'IsObject decorator'));
    test('aiSuggested field',            () => assertContains('prd/dto/update-section.dto.ts', 'aiSuggested', 'aiSuggested field'));
  });

  describe('app.module.ts — PrdModule registered', () => {
    test('PrdModule imported in AppModule', () => assertContains('app.module.ts', 'PrdModule', 'PrdModule in AppModule'));
  });

  describe('Unit spec files', () => {
    test('prd.service.spec.ts exists',   () => assertExists('prd/prd.service.spec.ts', 'prd.service.spec.ts'));
    test('prd.controller.spec.ts exists',() => assertExists('prd/prd.controller.spec.ts', 'prd.controller.spec.ts'));
  });

});
