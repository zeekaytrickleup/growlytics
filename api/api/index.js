// Vercel serverless entry for the NestJS API.
// A vercel.json rewrite sends every /api/* request here; this boots the *compiled* Nest app
// (dist/, built by `vercel-build` with full decorator metadata) once and reuses it.
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');
const { AppModule } = require('../dist/src/app.module');

const server = express();
let cached = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api');
  const webOrigin = process.env.WEB_ORIGIN;
  app.enableCors({
    origin:
      webOrigin === '*'
        ? true
        : webOrigin
          ? webOrigin.split(',').map((o) => o.trim())
          : true,
    credentials: true,
  });
  await app.init();
  return server;
}

module.exports = async (req, res) => {
  if (!cached) cached = bootstrap();
  const app = await cached;
  app(req, res);
};
