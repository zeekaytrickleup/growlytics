import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All routes under /api (frontend calls <api-url>/api/...)
  app.setGlobalPrefix('api');

  // CORS. WEB_ORIGIN can be a comma-separated allowlist, or "*" to reflect any origin
  // (handy for a quick free deploy before the frontend URL is known).
  const webOrigin = process.env.WEB_ORIGIN;
  app.enableCors({
    origin:
      webOrigin === '*'
        ? true
        : (webOrigin?.split(',').map((o) => o.trim()) ?? ['http://localhost:3000', 'http://localhost:3007']),
    credentials: true,
  });

  // 0.0.0.0 so cloud hosts (Render, Fly, etc.) can route traffic to the container.
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Growlytics API listening on port ${port} (prefix /api)`);
}
bootstrap();
