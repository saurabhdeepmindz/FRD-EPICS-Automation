# Database Rules — PostgreSQL + Objection.js + Knex

Stack: PostgreSQL 12+, Objection.js 3.x, Knex 3.x, snake_case column mapping.

---

## Core Rules

- PostgreSQL is the single source of truth for all structured application data
- All schema changes must have a Knex migration file — never modify schema manually
- All database access must go through repository classes — no direct ORM calls in services or controllers
- Parameterize all queries — never concatenate user input into query strings
- Use transactions when multiple writes must succeed together
- Avoid N+1 query patterns — use eager loading or joins instead

---

## Repository Pattern

Every entity must have a corresponding repository that extends `DatabaseRepository<T>`.

```
libs/<domain>/src/
├── models/
│   └── <entity>.ts                # XxxModel extends BaseModel
└── repositories/
    └── <entity>/
        ├── contract.ts            # IXxxRepository interface
        └── database.ts            # XxxRepository extends DatabaseRepository<XxxModel>
```

### Repository Contract

```typescript
// repositories/<entity>/contract.ts
export interface IXxxRepository extends IRepository<XxxModel> {
  findBySlug(slug: string): Promise<XxxModel | undefined>;
  findAllActive(): Promise<XxxModel[]>;
}
```

### Repository Implementation

```typescript
// repositories/<entity>/database.ts
@Injectable()
export class XxxRepository extends DatabaseRepository<XxxModel>
  implements IXxxRepository {

  get model(): typeof XxxModel {
    return XxxModel;
  }

  async findBySlug(slug: string): Promise<XxxModel | undefined> {
    return this.firstWhere({ slug });
  }

  async findAllActive(): Promise<XxxModel[]> {
    return this.getWhere({ status: Status.ACTIVE });
  }
}
```

### Injecting Repositories

Use the constants-based injection pattern via `@Inject()`:

```typescript
// libs/<domain>/src/constant.ts
export const DomainLibConstants = {
  XXX_REPOSITORY: 'XXX_REPOSITORY',
  YYY_REPOSITORY: 'YYY_REPOSITORY',
};

// libs/<domain>/src/module.ts
@Module({
  providers: [
    { provide: DomainLibConstants.XXX_REPOSITORY, useClass: XxxRepository },
    { provide: DomainLibConstants.YYY_REPOSITORY, useClass: YyyRepository },
    DomainLibService,
  ],
  exports: [DomainLibService],
})
export class DomainLibModule {}

// libs/<domain>/src/services/index.ts
@Injectable()
export class DomainLibService {
  constructor(
    @Inject(DomainLibConstants.XXX_REPOSITORY)
    public readonly xxxRepo: XxxRepository,
    @Inject(DomainLibConstants.YYY_REPOSITORY)
    public readonly yyyRepo: YyyRepository,
  ) {}
}
```

---

## ORM Models

All models extend `BaseModel` from `@libs/database`.

```typescript
// libs/<domain>/src/models/<entity>.ts
import { BaseModel } from '@libs/database';

export class XxxModel extends BaseModel {
  static tableName = '<table_name>';

  // Columns — typed as per schema
  id: number;
  uuid: string;
  name: string;
  status: number;
  preferences: Record<string, unknown>;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  static get relationMappings() {
    return {
      // HasOneThroughRelation — many-to-many through join table
      roles: {
        relation: BaseModel.HasOneThroughRelation,
        modelClass: RoleModel,
        join: {
          from: '<table>.id',
          through: {
            from: 'role_<table>.xxx_id',
            to: 'role_<table>.role_id',
          },
          to: 'roles.id',
        },
      },
      // BelongsToOneRelation — foreign key on this table
      owner: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: '<table>.user_id',
          to: 'users.id',
        },
      },
      // HasManyRelation — foreign key on the related table
      items: {
        relation: BaseModel.HasManyRelation,
        modelClass: XxxItemModel,
        join: {
          from: '<table>.id',
          to: '<table>_items.xxx_id',
        },
      },
    };
  }
}
```

### Loading Relations

```typescript
// Lazy load (only fetches if not already loaded)
await record.$load('owner');

// Force reload
await record.$forceLoad('items');

// Eager load in repository query
const record = await xxxRepo.firstWhere({ id }, { withRelated: ['owner', 'items'] });
```

---

## Migration Conventions

### File Naming
```
database/migrations/YYYYMMDDHHMMSS_create_<table>.js
database/migrations/YYYYMMDDHHMMSS_add_<column>_to_<table>.js
database/migrations/YYYYMMDDHHMMSS_alter_<table>_<description>.js
```

### Migration Template

```javascript
// database/migrations/20240101000000_create_<table>.js
const { timestamps, onUpdateTrigger, ON_UPDATE_TIMESTAMP_FUNCTION } = require('../utils');

exports.up = async function (knex) {
  await knex.raw(ON_UPDATE_TIMESTAMP_FUNCTION);  // idempotent — safe to run repeatedly

  await knex.schema.createTable('<table>', (table) => {
    // Required on every table
    table.bigIncrements('id').primary();
    table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()'));

    // Domain columns
    table.string('name', 255).notNullable();
    table.smallint('status').notNullable().defaultTo(1).index();

    // Foreign key
    table.bigInteger('user_id').unsigned().references('id').inTable('users')
         .onDelete('CASCADE').index();

    // JSONB for flexible/non-queryable metadata
    table.jsonb('preferences').defaultTo('{}');
    table.jsonb('meta');

    timestamps(knex, table);  // creates created_at, updated_at
  });

  await knex.raw(onUpdateTrigger('<table>'));  // auto-update updated_at on every UPDATE
};

exports.down = async function (knex) {
  await knex.schema.dropTable('<table>');
};
```

### Adding Columns

```javascript
// database/migrations/20240201000000_add_<column>_to_<table>.js
exports.up = async function (knex) {
  await knex.schema.alterTable('<table>', (table) => {
    table.string('<column>').nullable().after('<preceding_column>');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('<table>', (table) => {
    table.dropColumn('<column>');
  });
};
```

---

## Schema Design Rules

### Required Columns (every table)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigIncrements` | Internal primary key — never expose to API clients |
| `uuid` | `uuid` | Public-facing identifier — always expose this |
| `created_at` | `timestamp` | Auto-set via `timestamps()` |
| `updated_at` | `timestamp` | Auto-updated via DB trigger |

### Naming
- All column names: `snake_case`
- Boolean columns: `is_<state>` (e.g., `is_email_verified`, `is_active`)
- Enum-like fields: `smallint` with values documented in code constants, never magic numbers
- Foreign keys: `<table_singular>_id` (e.g., `user_id`, `role_id`); always indexed
- Soft delete: `deleted_at timestamp nullable` — only when the product explicitly requires it

### Indexing
- Always index foreign key columns
- Index columns used frequently in `WHERE` clauses
- Index `status`, `user_type`, and other filter fields
- Use composite indexes for common multi-column filter patterns

```javascript
table.bigInteger('user_id').unsigned().references('id').inTable('users')
     .onDelete('CASCADE').index();
table.smallint('status').notNullable().defaultTo(1).index();
table.index(['user_id', 'status'], 'idx_user_id_status');  // composite
```

### JSONB Columns

Use `jsonb` for:
- User preferences (theme, notification settings, language)
- Entity-type-specific metadata that varies per record
- Fields that are stored but not individually queried or sorted

Do NOT use `jsonb` for:
- Fields that need filtering, sorting, or joining
- Required, validated, or strongly-typed fields
- Fields that will grow unbounded

---

## Transactions

Use `repo.transaction()` for any multi-step write operation:

```typescript
await this.xxxRepo.transaction(async (trx) => {
  const record = await this.xxxRepo.create(payload, trx);
  await this.yyyRepo.create({ xxxId: record.id, ...details }, trx);
  await this.auditRepo.create({ action: 'xxx.created', entityId: record.id }, trx);
  // All three writes succeed or all roll back together
});
```

---

## Avoiding N+1 Queries

```typescript
// BAD: N+1 — fires one query per record in the loop
const records = await xxxRepo.all();
for (const record of records) {
  await record.$load('items');   // N additional queries
}

// GOOD: eager load upfront in a single query
const records = await xxxRepo.all({ withRelated: ['items'] });

// GOOD: batch processing for large datasets
await xxxRepo.chunk(100, async (batch) => {
  await processBatch(batch);
});
```

---

## Transactions

Use `repo.transaction()` for any multi-step write operation that must be atomic:

```typescript
await this.xxxRepo.transaction(async (trx) => {
  const record = await this.xxxRepo.create(payload, trx);
  await this.yyyRepo.create({ xxxId: record.id }, trx);
});
```

---

## Do Not

- Write raw SQL inside controllers or services
- Call Objection.js/Knex queries directly outside repository classes
- Make schema changes without a migration file
- Use `any` as a model type — always define column types explicitly
- Store sensitive data (passwords, tokens) without hashing/encryption
- Assume single-tenant schema if the product is multi-tenant
- Delete or modify migration files that have already been applied to any environment
