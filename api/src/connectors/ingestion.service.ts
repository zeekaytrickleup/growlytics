import { Injectable, Logger } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';
import { ShopifyConnector } from './shopify.connector';
import { Connector } from './connector.interface';

const WORKSPACE_ID = 'demo-workspace';

/**
 * Runs a connector and persists its normalized output into the DB, then refreshes insights.
 * This is the metrics-sync layer: the UI and AI always read the normalized tables, never a vendor
 * API directly (MASTER_PLAN §3.2).
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly connectors: Partial<Record<Provider, Connector>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    shopify: ShopifyConnector,
  ) {
    this.connectors = { [Provider.SHOPIFY]: shopify };
  }

  supports(provider: Provider): boolean {
    return provider in this.connectors;
  }

  /** Sync one provider into the normalized tables. Returns a summary of what was ingested. */
  async ingest(provider: Provider, workspaceId: string = WORKSPACE_ID) {
    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: { id: workspaceId, name: 'Northwind Goods' },
    });

    const connector = this.connectors[provider];
    if (!connector) {
      // No data connector yet (e.g. GA4/Meta stubs) — just record the connection.
      return { provider, ingested: false };
    }

    const data = await connector.sync();

    // Upsert products by external id.
    for (const p of data.products) {
      await this.prisma.product.upsert({
        where: { workspaceId_externalId: { workspaceId, externalId: p.externalId } },
        update: { name: p.name, revenue: p.revenue, orders: p.orders, conversionRt: p.conversionRt, stock: p.stock, aiScore: p.aiScore },
        create: { workspaceId, ...p },
      });
    }

    // Replace this source's metric rows (leaves other sources — e.g. GA4 traffic — intact).
    await this.prisma.metricSnapshot.deleteMany({
      where: { workspaceId, source: provider, metric: { in: ['kpi', 'kpi_prev', 'revenue', 'revenue_prev'] } },
    });
    const now = new Date();
    const kpiRows = data.kpis.flatMap((k) => [
      { workspaceId, source: provider, metric: 'kpi', dimension: k.key, value: k.cur, ts: now },
      { workspaceId, source: provider, metric: 'kpi_prev', dimension: k.key, value: k.prev, ts: now },
    ]);
    const revRows = data.revenueSeries.flatMap((r, i) => {
      const ts = new Date(now.getTime() - (data.revenueSeries.length - i) * 86_400_000);
      return [
        { workspaceId, source: provider, metric: 'revenue', dimension: r.d, value: r.rev, ts },
        { workspaceId, source: provider, metric: 'revenue_prev', dimension: r.d, value: r.prev, ts },
      ];
    });
    await this.prisma.metricSnapshot.createMany({ data: [...kpiRows, ...revRows] });

    // Fresh data → fresh insights.
    const generated = await this.insights.generate(workspaceId).catch(() => ({ generated: 0 }));

    this.logger.log(`Ingested ${provider}: ${data.products.length} products, ${data.kpis.length} KPIs.`);
    return {
      provider,
      ingested: true,
      products: data.products.length,
      kpis: data.kpis.length,
      insightsGenerated: generated.generated,
    };
  }
}
