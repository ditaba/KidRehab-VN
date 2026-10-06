import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

// Load apps/api/.env when present (Node >= 20.12). Real environments inject variables directly.
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Behind a reverse proxy / load balancer terminating HTTPS.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  setupApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`KidRehab API listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
