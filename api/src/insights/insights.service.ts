import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InsightStatus } from '@prisma/client';
import { detectSignals } from './insights.rules';

const WORKSPACE_ID = 'demo-workspace';

/**
 * Detects notable changes and risks in the workspace's real metrics and writes them as Insight
 * rows — the "What should you do today?" cards then read straight from the DB. Runs nightly and
 * on demand. This is the rules half of the recommendation engine (MASTER_PLAN §Phase 3); LLM
 * copy-polishing can layer on top later without changing the detection logic.
 */
@Injectable()
export class InsightsService implements OnModuleInit {
  private readonly logger = new Logger(InsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Generate once at startup for any workspace that has data but no insights yet.
    try {
      const workspaces = await this.prisma.workspace.findMany();
      for (const ws of workspaces) {
        const count = await this.prisma.insight.count({ where: { workspaceId: ws.id } });
        if (count === 0) await this.generate(ws.id);
      }
    } catch {
      /* no DB yet — skip */
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async nightly() {
    try {
      const workspaces = await this.prisma.workspace.findMany();
      for (const ws of workspaces) await this.generate(ws.id);
      this.logger.log(`Nightly insights regenerated for ${workspaces.length} workspace(s).`);
    } catch (err) {
      this.logger.warn(`Nightly insight run skipped: ${(err as Error).message}`);
    }
  }

  async list(workspaceId: string = WORKSPACE_ID) {
    const insights = await this.prisma.insight.findMany({
      where: { workspaceId },
      orderBy: { confidence: 'desc' },
    });
    return { insights };
  }

  /** Recompute insights from current metrics and replace the workspace's insight rows. */
  async generate(workspaceId: string = WORKSPACE_ID) {
    const [metrics, products] = await Promise.all([
      this.prisma.metricSnapshot.findMany({ where: { workspaceId } }),
      this.prisma.product.findMany({ where: { workspaceId }, orderBy: { revenue: 'desc' } }),
    ]);

    const cur = new Map(metrics.filter((m) => m.metric === 'kpi').map((m) => [m.dimension!, m.value]));
    const prev = new Map(metrics.filter((m) => m.metric === 'kpi_prev').map((m) => [m.dimension!, m.value]));

    const signals = detectSignals(cur, prev, products);

    // Replace existing insights with the fresh set.
    await this.prisma.insight.deleteMany({ where: { workspaceId } });
    if (signals.length) {
      await this.prisma.insight.createMany({
        data: signals.map((s) => ({
          workspaceId,
          type: s.type,
          title: s.title,
          body: s.body,
          confidence: s.confidence,
          payload: { tag: s.tag, cta: s.cta },
          status: InsightStatus.NEW,
        })),
      });
    }
    return { generated: signals.length, insights: signals };
  }
}
