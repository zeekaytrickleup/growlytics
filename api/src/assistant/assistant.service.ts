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

  /** Build a compact snapshot of the workspace's connected data for grounding the LLM. */
  private async buildContext(workspaceId: string) {
    const overview = await this.dashboard.getOverview(workspaceId);
    let segments: { name: string; ltv: number | null }[] = [];
    let store = 'Northwind Goods';
    try {
      const [segs, ws] = await Promise.all([
        this.prisma.segment.findMany({ where: { workspaceId } }),
        this.prisma.workspace.findUnique({ where: { id: workspaceId } }),
      ]);
      segments = segs.map((s) => ({ name: s.name, ltv: null }));
      if (ws) store = ws.name;
    } catch {
      // no DB — overview mock is still enough context
    }
    return {
      store,
      period: 'last 90 days',
      kpis: overview.kpis,
      revenueSeries: overview.revenueSeries,
      trafficSources: overview.trafficSources,
      topProducts: overview.topProducts,
      customerSegments: segments,
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
