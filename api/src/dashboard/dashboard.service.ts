import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const WORKSPACE_ID = 'demo-workspace';

// Display config for KPI tiles — order + label + value formatting. Deltas are computed from the
// current vs previous MetricSnapshot values, so the whole KPI row is DB-driven.
const KPI_CONFIG: { key: string; label: string; fmt: (v: number) => string }[] = [
  { key: 'revenue', label: 'Revenue', fmt: (v) => `$${(v / 1000).toFixed(1)}k` },
  { key: 'orders', label: 'Orders', fmt: (v) => Math.round(v).toLocaleString('en-US') },
  { key: 'profit', label: 'Profit', fmt: (v) => `$${(v / 1000).toFixed(1)}k` },
  { key: 'roas', label: 'ROAS', fmt: (v) => `${v}x` },
  { key: 'aov', label: 'Avg Order Value', fmt: (v) => `$${v}` },
  { key: 'cr', label: 'Conversion Rate', fmt: (v) => `${v}%` },
  { key: 'ltv', label: 'Customer LTV', fmt: (v) => `$${v}` },
  { key: 'returning', label: 'Returning', fmt: (v) => `${v}%` },
];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(workspaceId: string = WORKSPACE_ID) {
    try {
      const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (ws) {
        const live = await this.buildLiveOverview(workspaceId);
        if (live) return live;
      }
    } catch (err) {
      this.logger.warn(`Falling back to mock overview: ${(err as Error).message}`);
    }
    return this.getMockOverview();
  }

  private async buildLiveOverview(workspaceId: string) {
    const [metrics, products, insights] = await Promise.all([
      this.prisma.metricSnapshot.findMany({
        where: { workspaceId },
        orderBy: { ts: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { workspaceId },
        orderBy: { revenue: 'desc' },
        take: 5,
      }),
      this.prisma.insight.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!metrics.length && !products.length) return null;

    const byMetric = (m: string) => metrics.filter((r) => r.metric === m);
    const cur = new Map(byMetric('kpi').map((r) => [r.dimension, r.value]));
    const prev = new Map(byMetric('kpi_prev').map((r) => [r.dimension, r.value]));

    const kpis = KPI_CONFIG.filter((c) => cur.has(c.key)).map((c) => {
      const v = cur.get(c.key)!;
      const p = prev.get(c.key) ?? v;
      const deltaPct = p ? Math.round(Math.abs((v - p) / p) * 100) : 0;
      return { key: c.key, label: c.label, value: c.fmt(v), delta: `${deltaPct}%`, kind: v >= p ? 'up' : 'down' };
    });

    // Rebuild the day-ordered revenue series from the two daily metrics.
    const revThis = byMetric('revenue');
    const prevMap = new Map(byMetric('revenue_prev').map((r) => [r.dimension, r.value]));
    const revenueSeries = revThis.map((r) => ({ d: r.dimension!, rev: r.value, prev: prevMap.get(r.dimension!) ?? 0 }));

    const trafficSources = byMetric('traffic').map((r) => ({ name: r.dimension!, value: r.value }));

    const topProducts = products.map((p) => ({
      name: p.name,
      rev: `$${(p.revenue / 1000).toFixed(1)}k`,
      orders: p.orders,
      cr: p.conversionRt,
      trend: (p.aiScore ?? 0.5) >= 0.65 ? 'up' : (p.aiScore ?? 0.5) <= 0.35 ? 'down' : 'flat',
      stock: p.stock,
    }));

    const insightCards = insights.map((i) => {
      const payload = (i.payload ?? {}) as { tag?: string; cta?: string };
      return { type: i.type, tag: payload.tag ?? i.type, title: i.title, body: i.body, cta: payload.cta ?? 'View' };
    });

    return {
      source: 'live',
      kpis,
      insights: insightCards,
      revenueSeries,
      trafficSources,
      topProducts,
    };
  }

  private getMockOverview() {
    return {
      source: 'mock',
      kpis: [
        { key: 'revenue', label: 'Revenue', value: '$81.2k', delta: '18%', kind: 'up' },
        { key: 'orders', label: 'Orders', value: '1,942', delta: '9%', kind: 'up' },
        { key: 'profit', label: 'Profit', value: '$29.4k', delta: '14%', kind: 'up' },
        { key: 'roas', label: 'ROAS', value: '3.8x', delta: '12%', kind: 'down' },
        { key: 'aov', label: 'Avg Order Value', value: '$41.8', delta: '3%', kind: 'up' },
        { key: 'cr', label: 'Conversion Rate', value: '3.4%', delta: '6%', kind: 'up' },
        { key: 'ltv', label: 'Customer LTV', value: '$186', delta: '8%', kind: 'up' },
        { key: 'returning', label: 'Returning', value: '42%', delta: '2%', kind: 'up' },
      ],
      insights: [
        { type: 'revenue', tag: 'Revenue', title: 'Revenue up 18% this week', body: 'Weekend campaigns drove $12.4k in incremental sales vs. last week.', cta: 'See breakdown' },
        { type: 'ads', tag: 'Ads · Meta', title: 'ROAS dropped 12%', body: "Meta 'Retargeting-Q3' is fatiguing. Refresh creative to recover ~$3.1k.", cta: 'Fix campaign' },
        { type: 'product', tag: 'Product', title: 'Aurora Buds is trending', body: 'Sessions +64% in 48h. Consider raising ad budget while momentum lasts.', cta: 'Scale product' },
        { type: 'inventory', tag: 'Inventory', title: 'Restock Flux Smart Bottle', body: 'Only 12 units left. Projected stockout in 3 days at current velocity.', cta: 'Create PO' },
      ],
      revenueSeries: [
        { d: 'Mon', rev: 8200, prev: 7100 }, { d: 'Tue', rev: 9100, prev: 8300 },
        { d: 'Wed', rev: 7600, prev: 8000 }, { d: 'Thu', rev: 11200, prev: 9200 },
        { d: 'Fri', rev: 14800, prev: 10100 }, { d: 'Sat', rev: 16900, prev: 12400 },
        { d: 'Sun', rev: 13400, prev: 11800 },
      ],
      trafficSources: [
        { name: 'Organic', value: 38 }, { name: 'Paid Ads', value: 29 },
        { name: 'Email', value: 17 }, { name: 'Social', value: 11 }, { name: 'Direct', value: 5 },
      ],
      topProducts: [
        { name: 'Aurora Wireless Buds', rev: '$48.2k', orders: 812, cr: 4.8, trend: 'up', stock: 340 },
        { name: 'Nimbus Hoodie', rev: '$31.7k', orders: 640, cr: 3.9, trend: 'up', stock: 88 },
        { name: 'Flux Smart Bottle', rev: '$22.4k', orders: 511, cr: 3.1, trend: 'down', stock: 12 },
        { name: 'Lumen Desk Lamp', rev: '$18.9k', orders: 402, cr: 2.7, trend: 'up', stock: 205 },
        { name: 'Terra Yoga Mat', rev: '$14.1k', orders: 388, cr: 2.2, trend: 'flat', stock: 61 },
      ],
    };
  }
}
