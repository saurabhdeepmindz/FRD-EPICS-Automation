# DevOps & Deployment Rules

---

## Environments

| Environment | Config File | Command |
|-------------|------------|---------|
| Development | `dev.ecosystem.config.js` | `npm run start:all:dev` |
| QA | `qa.ecosystem.config.js` | `npm run start:all:qa` |
| Production | `prod.ecosystem.config.js` | `npm run start:all:prod` |

Never use development configuration in production. Always validate `NODE_ENV`.

---

## PM2 Process Management

```javascript
// dev.ecosystem.config.js (example pattern)
module.exports = {
  apps: [
    {
      name: 'auth-apis',
      script: 'dist/apps/auth-apis/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
    },
    {
      name: 'chat-apis',
      script: 'dist/apps/chat-apis/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_development: {
        NODE_ENV: 'development',
        PORT: 3002,
      },
    },
  ],
};
```

**Rules:**
- Always build before deploying production: `npm run build && pm2 start prod.ecosystem.config.js`
- Use `pm2 logs` to tail all app logs
- Configure PM2 startup: `pm2 startup` + `pm2 save` for auto-restart on reboot
- Use `pm2 monit` for real-time monitoring

---

## Docker

```dockerfile
# Dockerfile — multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
USER node
CMD ["node", "dist/apps/auth-apis/src/main.js"]
```

```
# .dockerignore
node_modules
dist
.env
.env.*
!.env.example
.git
coverage
*.spec.ts
```

**Rules:**
- Use multi-stage builds — keep production images lean
- Run as non-root user (`USER node`)
- Never bake `.env` files into images
- Use `.dockerignore` to exclude `node_modules`, `.env`, `.git`
- One service per container
- Health check in Dockerfile:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
    CMD curl -f http://localhost:3001/api/v1/health || exit 1
  ```

---

## Environment Variables

All environment variables must have:
1. An entry in `.env.example` with a placeholder value (not a real secret)
2. A corresponding `config/*.ts` loader
3. Validation at startup (fail fast if required vars are missing)

```typescript
// config/app.ts — validate required vars
export default registerAs('app', () => {
  const required = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  return {
    port: Number(process.env.PORT ?? 3001),
    env: process.env.NODE_ENV ?? 'development',
    jwtSecret: process.env.JWT_SECRET,
  };
});
```

### Required Environment Variables

```bash
# .env.example
# Application
NODE_ENV=development
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=<your_project_name>
DB_USER=postgres
DB_PASSWORD=

# Authentication
JWT_SECRET=
JWT_LIFETIME=1h
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_LIFETIME=7d

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage (AWS S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=<your-aws-region>
S3_BUCKET=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Error Tracking
SENTRY_DSN=

# External Services
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
```

---

## Database Migrations

```bash
# Run pending migrations
npx knex migrate:latest --knexfile knexfile.js

# Rollback last batch
npx knex migrate:rollback --knexfile knexfile.js

# Check migration status
npx knex migrate:status --knexfile knexfile.js

# Create a new migration
npx knex migrate:make <migration_name> --knexfile knexfile.js
```

**Deployment checklist:**
1. Build: `npm run build`
2. Run migrations: `npx knex migrate:latest`
3. Start/restart app: `pm2 restart <name>`
4. Verify health: `curl http://localhost:3001/api/v1/health`

---

## AWS Deployment

### Services Used
| Service | Purpose |
|---------|---------|
| ECS Fargate | Container hosting for microservices |
| RDS PostgreSQL | Managed database |
| ElastiCache Redis | Managed Redis |
| S3 | File storage |
| SES | Transactional email |
| SNS | Push notifications |
| Lambda | Serverless functions |
| CloudWatch | Logging and metrics |

**Rules:**
- Use least-privilege IAM policies — grant only what each service needs
- Enable VPC for RDS and ElastiCache — never expose directly to internet
- Use environment variables from Secrets Manager in ECS task definitions
- Enable CloudWatch structured logging with log groups per service
- Configure CloudWatch alarms for error rate, CPU, and memory thresholds
- Use Application Load Balancer with health checks for ECS services

---

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml (example structure)
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test:cov
```

**Pipeline requirements:**
1. Lint must pass — no errors
2. Build must succeed — no TypeScript errors
3. Tests must pass — coverage ≥ 80%
4. All checks must pass before merge to `main`

---

## VPS / Self-Hosted

If running on VPS (Ubuntu/Debian):

```bash
# Reverse proxy with Nginx
server {
    listen 443 ssl;
    server_name api.<your-domain>.com;

    location /auth/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Security:**
- Use SSL via Let's Encrypt (Certbot)
- Configure UFW: only expose ports 80, 443, 22
- Disable password SSH authentication — keys only
- Run Node processes as non-root user
- Set up `unattended-upgrades` for security patches

---

## Health & Monitoring

Every service must respond at `/api/v1/health`:
```json
{ "success": true, "data": { "status": "ok", "timestamp": "2024-01-01T00:00:00Z" } }
```

Monitor:
- HTTP error rate (alert on > 1% 5xx)
- Response time (alert on p95 > 2 seconds)
- Memory usage (alert on > 80% of container limit)
- Database connection pool exhaustion
- Cache hit rate (warn if < 50% for high-traffic routes)

---

## Do Not

- Hardcode AWS account IDs, ARNs, or region-specific resource names in code
- Expose database or Redis ports to the public internet
- Run Node.js processes as root
- Bake secrets or `.env` files into Docker images
- Deploy without running migrations first
- Skip health check verification after deployment
- Use `npm install` in production — always use `npm ci`
