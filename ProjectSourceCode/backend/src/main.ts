import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix — all routes under /api
  app.setGlobalPrefix('api');

  // Validate and transform all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,       // auto-transform payloads to DTO types
    }),
  );

  // CORS — allow frontend origin (loaded from env). Also accept
  // file:// origin (sent as `Origin: null`) so the downloaded
  // LLD-MOD-NN-rtm.html bundle's "Generate file" button can call back to
  // /api/ba/artifacts/:id/rtm/generate-missing-file when a customer opens
  // it locally. Same-origin (no Origin header, e.g. curl) also passes.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin, cb) => {
      // No Origin header (same-origin / curl / Postman) → allow.
      if (!origin) return cb(null, true);
      // file:// pages send Origin: null
      if (origin === 'null') return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}/api`);
}

bootstrap();
