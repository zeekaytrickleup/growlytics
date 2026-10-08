import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { AiService, AIAnswer } from '../ai/ai.service';

const WORKSPACE_ID = 'demo-workspace';

export const SUGGESTED_QUESTIONS = [
  'Why did sales drop yesterday?',
  'Which products should I advertise?',
  'Which customers are likely to churn?',
  'What should I do this week?',
];

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly ai: AiService,
  ) {}

  suggestions() {
    return { suggestions: SUGGESTED_QUESTIONS, aiEnabled: this.ai.enabled };
  }

  /** Build a compact snapshot of ALL the workspace's connected data for grounding the LLM. */
  private async buildContext(workspaceId: string) {
    // Pull every connected area in parallel; each falls back independently so one failure
    // never blanks the whole snapshot.
    const [overview, productsRes, seo, marketing] = await Promise.all([
      this.dashboard.getOverview(workspaceId).catch(() => null),
      this.dashboard.getProducts(workspaceId).catch(() => null),
      this.dashboard.getSeo(workspaceId).catch(() => null),
      this.dashboard.getMarketing(workspaceId).catch(() => null),
    ]);

    let segments: { name: string; n: number }[] = [];
    let store = 'your store';
    try {
      const [segs, ws] = await Promise.all([
        this.prisma.segment.findMany({ where: { workspaceId } }),
        this.prisma.workspace.findUnique({ where: { id: workspaceId } }),
      ]);
      segments = segs.map((s) => ({ name: s.name, n: 0 }));
      if (ws) store = ws.name;
    } catch {
      // no DB — the data above is still enough context
    }

    // Keep it compact: cap list sizes so the prompt stays small but representative.
    return {
      store,
      period: 'last 90 days',
      dataSources: {
        store: overview?.source ?? 'none',
        seo: seo?.source ?? 'none',
        marketing: marketing?.source ?? 'none',
      },
      kpis: overview?.kpis ?? [],
      revenueSeries: overview?.revenueSeries ?? [],
      trafficSources: overview?.trafficSources ?? [],
      // Full product list (name, revenue, orders, conversion, stock) for product/inventory questions.
      products: (productsRes?.products ?? overview?.topProducts ?? []).slice(0, 15),
      customerSegments: segments,
      // Real SEO (Search Console) — headline metrics + top keywords.
      seo: seo
        ? { source: seo.source, kpis: seo.kpis, topKeywords: (seo.keywords ?? []).slice(0, 10) }
        : null,
      // Marketing channels (email/ads) — spend, revenue, ROAS.
      marketing: marketing
        ? { source: marketing.source, kpis: marketing.kpis, channels: marketing.channels }
        : null,
    };
  }

  async ask(question: string, workspaceId: string = WORKSPACE_ID): Promise<{ answer: AIAnswer }> {
    const context = await this.buildContext(workspaceId);
    const answer = await this.ai.answer(question, context);

    // Persist the exchange (best-effort — skip silently if DB is unavailable).
    try {
      await this.prisma.chatMessage.create({
        data: { workspaceId, role: 'USER', text: question },
      });
      await this.prisma.chatMessage.create({
        data: {
          workspaceId,
          role: 'ASSISTANT',
          text: answer.analysis,
          payload: answer as unknown as object,
        },
      });
    } catch (err) {
      this.logger.debug(`Chat not persisted: ${(err as Error).message}`);
    }

    return { answer };
  }
}
