import { Injectable, Logger } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';
import { ShopifyConnector } from './shopify.connector';
import { WooCommerceConnector } from './woocommerce.connector';
import { KlaviyoConnector } from './klaviyo.connector';
import { SearchConsoleConnector } from './search-console.connector';
import { Connector, ConnectorConfig } from './connector.interface';
import { MarketingConnector } from './marketing.interface';
import { WooCredentialsService } from './woo-credentials.service';
import { CredentialsStore } from './credentials.store';

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
  private readonly marketingConnectors: Partial<Record<Provider, MarketingConnector>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly wooCreds: WooCredentialsService,
    private readonly creds: CredentialsStore,
    private readonly searchConsole: SearchConsoleConnector,
    shopify: ShopifyConnector,
    woocommerce: WooCommerceConnector,
    klaviyo: KlaviyoConnector,
  ) {
    this.connectors = { [Provider.SHOPIFY]: shopify, [Provider.WOOCOMMERCE]: woocommerce };
    this.marketingConnectors = { [Provider.KLAVIYO]: klaviyo };
  }

  supportsSeo(provider: Provider): boolean {
    return provider === Provider.SEARCH_CONSOLE;
  }

  /** Sync Google Search Console into seo_* MetricSnapshots. */
  async ingestSeo(provider: Provider, workspaceId: string = WORKSPACE_ID) {
    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: { id: workspaceId, name: 'Northwind Goods' },
    });
    const credsData = await this.creds.resolve(workspaceId, provider);
    if (!credsData) throw new Error('Search Console not configured — add a service account key + site URL.');
    const data = await this.searchConsole.sync(credsData);

    await this.prisma.metricSnapshot.deleteMany({
      where: {
        workspaceId,
        source: provider,
        metric: { in: ['seo_cur', 'seo_prev', 'seo_day', 'seo_kw_clicks', 'seo_kw_impr', 'seo_kw_ctr', 'seo_kw_pos'] },
      },
    });
    const now = new Date();
    const rows: { workspaceId: string; source: Provider; metric: string; dimension: string; value: number; ts: Date }[] = [];
    // Totals (cur + prev) stored as one metric each with dimension = field name.
    for (const [period, agg] of [['seo_cur', data.cur], ['seo_prev', data.prev]] as const) {
      rows.push(
        { workspaceId, source: provider, metric: period, dimension: 'clicks', value: agg.clicks, ts: now },
        { workspaceId, source: provider, metric: period, dimension: 'impressions', value: agg.impressions, ts: now },
        { workspaceId, source: provider, metric: period, dimension: 'ctr', value: agg.ctr, ts: now },
        { workspaceId, source: provider, metric: period, dimension: 'position', value: agg.position, ts: now },
      );
    }
    for (const d of data.daily) rows.push({ workspaceId, source: provider, metric: 'seo_day', dimension: d.date, value: d.clicks, ts: now });
    for (const k of data.keywords) {
      rows.push(
        { workspaceId, source: provider, metric: 'seo_kw_clicks', dimension: k.query, value: k.clicks, ts: now },
        { workspaceId, source: provider, metric: 'seo_kw_impr', dimension: k.query, value: k.impressions, ts: now },
        { workspaceId, source: provider, metric: 'seo_kw_ctr', dimension: k.query, value: k.ctr, ts: now },
        { workspaceId, source: provider, metric: 'seo_kw_pos', dimension: k.query, value: k.position, ts: now },
      );
    }
    await this.prisma.metricSnapshot.createMany({ data: rows });
    this.logger.log(`Ingested SEO ${provider}: ${data.keywords.length} keywords, ${data.daily.length} days.`);
    return { provider, ingested: true, keywords: data.keywords.length };
  }

  /** Per-workspace config for a connector (e.g. the WooCommerce store's saved credentials). */
  private async configFor(provider: Provider, workspaceId: string): Promise<ConnectorConfig | undefined> {
    if (provider === Provider.WOOCOMMERCE) {
      const creds = await this.wooCreds.resolve(workspaceId);
      return creds ? { ...creds } : undefined;
    }
    return undefined;
  }

  supports(provider: Provider): boolean {
    return provider in this.connectors || provider in this.marketingConnectors || this.supportsSeo(provider);
  }

  supportsMarketing(provider: Provider): boolean {
    return provider in this.marketingConnectors;
  }

  /** Sync a marketing provider (e.g. Klaviyo) into channel MetricSnapshots. */
  async ingestMarketing(provider: Provider, workspaceId: string = WORKSPACE_ID) {
    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: { id: workspaceId, name: 'Northwind Goods' },
    });
    const connector = this.marketingConnectors[provider];
    if (!connector) return { provider, ingested: false };

    const creds = (await this.creds.resolve(workspaceId, provider)) ?? {};
    const data = await connector.syncMarketing(creds);

    // Replace this provider's channel metrics.
    await this.prisma.metricSnapshot.deleteMany({
      where: { workspaceId, source: provider, metric: { in: ['mkt_spend', 'mkt_rev', 'mkt_conv', 'mkt_clicks', 'mkt_impr', 'mkt_rec'] } },
    });
    const now = new Date();
    const rows = data.channels.flatMap((c) => [
      { workspaceId, source: provider, metric: 'mkt_spend', dimension: c.name, value: c.spend, ts: now },
      { workspaceId, source: provider, metric: 'mkt_rev', dimension: c.name, value: c.revenue, ts: now },
      { workspaceId, source: provider, metric: 'mkt_conv', dimension: c.name, value: c.conversions, ts: now },
      { workspaceId, source: provider, metric: 'mkt_clicks', dimension: c.name, value: c.clicks, ts: now },
      { workspaceId, source: provider, metric: 'mkt_impr', dimension: c.name, value: c.impressions, ts: now },
    ]);
    await this.prisma.metricSnapshot.createMany({ data: rows });

    this.logger.log(`Ingested marketing ${provider}: ${data.channels.length} channel(s).`);
    return { provider, ingested: true, channels: data.channels.length };
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

    const config = await this.configFor(provider, workspaceId);
    const data = await connector.sync(config);

    // The connected store is authoritative — replace the workspace's products and its
    // KPI/revenue metrics from any prior source (so real store data isn't mixed with the seed).
    await this.prisma.product.deleteMany({ where: { workspaceId } });
    await this.prisma.product.createMany({ data: data.products.map((p) => ({ ...p, workspaceId })) });

    await this.prisma.metricSnapshot.deleteMany({
      where: { workspaceId, metric: { in: ['kpi', 'kpi_prev', 'revenue', 'revenue_prev', 'day_rev', 'day_ord'] } },
    });
    const now = new Date();

    // Daily history (for the dashboard period filter).
    const dailyRows = (data.dailySeries ?? []).flatMap((d) => {
      const ts = new Date(d.date + 'T00:00:00Z');
      return [
        { workspaceId, source: provider, metric: 'day_rev', dimension: d.date, value: d.rev, ts },
        { workspaceId, source: provider, metric: 'day_ord', dimension: d.date, value: d.orders, ts },
      ];
    });
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
    await this.prisma.metricSnapshot.createMany({ data: [...kpiRows, ...revRows, ...dailyRows] });

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
