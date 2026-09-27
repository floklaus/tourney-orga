import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Shared HTTP setup for main.ts and e2e tests. */
/** Large enough for 200 kB templates and 2 MB CSV imports (JSON-escaped). */
const BODY_LIMIT = '5mb';

export function configureApp(
  app: NestExpressApplication,
  corsOrigin?: string,
): void {
  app.setGlobalPrefix('api/v1');
  // Express 5 parses query strings flat by default; list filters use filter[key]=a,b.
  app.set('query parser', 'extended');
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.use(helmet());
  app.use(cookieParser());
  if (corsOrigin) app.enableCors({ origin: corsOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
