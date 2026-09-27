import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Number of reverse proxies in front of the API (Coolify's proxy + the Next.js /api rewrite = 2),
  // so rate limiting sees the real client IP from X-Forwarded-For.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  configureApp(app, process.env.CORS_ORIGIN);
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
