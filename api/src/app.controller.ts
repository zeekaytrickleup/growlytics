import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'growlytics-api', ts: new Date().toISOString() };
  }

  /**
   * DB keep-alive: a cheap query that touches the database so Supabase's free tier doesn't
   * auto-pause the project after ~7 days idle. Hit daily by a Vercel Cron (see vercel.json).
   */
  @Get('health/db')
  async getDbHealth() {
    try {
      const workspaces = await this.prisma.workspace.count();
      return { status: 'ok', db: 'reachable', workspaces, ts: new Date().toISOString() };
    } catch (err) {
      return { status: 'degraded', db: 'unreachable', error: (err as Error).message, ts: new Date().toISOString() };
    }
  }
}
