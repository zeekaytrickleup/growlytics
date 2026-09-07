// Vercel serverless entry for the NestJS API.
// Vercel (Root Directory = api) treats files under api/ as functions; this catch-all handles
// every /api/* request. It boots the *compiled* Nest app (dist/, built by `vercel-build` with
// full decorator metadata) once per warm instance and reuses it.
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
