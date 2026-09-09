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

  async getOverview(workspaceId: string = WORKSPACE_ID, opts: { days?: number; from?: string; to?: string } = {}) {
    try {
      const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (ws) {
        const live = await this.buildLiveOverview(workspaceId, opts);
        if (live) return live;
      }
    } catch (err) {
      this.logger.warn(`Falling back to mock overview: ${(err as Error).message}`);
    }
    return this.getMockOverview();
  }

  private async buildLiveOverview(workspaceId: string, opts: { days?: number; from?: string; to?: string } = {}) {
    const periodDays = opts.days ?? 30;
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
    const dayRev = new Map(byMetric('day_rev').map((r) => [r.dimension!, r.value]));
    const dayOrd = new Map(byMetric('day_ord').map((r) => [r.dimension!, r.value]));

    let kpis: { key: string; label: string; value: string; delta: string; kind: string }[];
    let revenueSeries: { d: string; rev: number; prev: number }[];

    if (dayRev.size && opts.from && opts.to) {
      // Custom date-range path: compute KPIs + chart between two explicit dates.
      const computed = this.rangeMetrics(dayRev, dayOrd, opts.from, opts.to);
      kpis = computed.kpis;
      revenueSeries = computed.revenueSeries;
    } else if (dayRev.size) {
      // Preset-period path: compute from daily history for the selected window.
      const computed = this.periodMetrics(dayRev, dayOrd, periodDays);
      kpis = computed.kpis;
      revenueSeries = computed.revenueSeries;
    } else {
      // Fallback: pre-aggregated kpi/revenue snapshots (period ignored).
      const cur = new Map(byMetric('kpi').map((r) => [r.dimension, r.value]));
      const prev = new Map(byMetric('kpi_prev').map((r) => [r.dimension, r.value]));
      kpis = KPI_CONFIG.filter((c) => cur.has(c.key)).map((c) => {
        const v = cur.get(c.key)!;
        const p = prev.get(c.key) ?? v;
        const deltaPct = p ? Math.round(Math.abs((v - p) / p) * 100) : 0;
        return { key: c.key, label: c.label, value: c.fmt(v), delta: `${deltaPct}%`, kind: v >= p ? 'up' : 'down' };
      });
      const revThis = byMetric('revenue');
      const prevMap = new Map(byMetric('revenue_prev').map((r) => [r.dimension, r.value]));
      revenueSeries = revThis.map((r) => ({ d: r.dimension!, rev: r.value, prev: prevMap.get(r.dimension!) ?? 0 }));
    }

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

  /** Compute KPIs + revenue chart for a period window from daily history. */
  private periodMetrics(dayRev: Map<string, number>, dayOrd: Map<string, number>, periodDays: number) {
    const DAYMS = 86_400_000;
    const key = (offset: number) => new Date(Date.now() - offset * DAYMS).toISOString().slice(0, 10);
    const sumWin = (map: Map<string, number>, startOff: number, endOff: number) => {
      let s = 0;
      for (let d = endOff; d < startOff; d++) s += map.get(key(d)) || 0;
      return s;
    };
    const revCur = sumWin(dayRev, periodDays, 0);
    const revPrev = sumWin(dayRev, 2 * periodDays, periodDays);
    const ordCur = sumWin(dayOrd, periodDays, 0);
    const ordPrev = sumWin(dayOrd, 2 * periodDays, periodDays);
    const vals: Record<string, [number, number]> = {
      revenue: [revCur, revPrev],
      orders: [ordCur, ordPrev],
      profit: [revCur * 0.36, revPrev * 0.36],
      aov: [ordCur ? revCur / ordCur : 0, ordPrev ? revPrev / ordPrev : 0],
    };
    const kpis = KPI_CONFIG.filter((c) => c.key in vals).map((c) => {
      const [v, p] = vals[c.key];
      const deltaPct = p ? Math.round(Math.abs((v - p) / p) * 100) : 0;
      return { key: c.key, label: c.label, value: c.fmt(v), delta: `${deltaPct}%`, kind: v >= p ? 'up' : 'down' };
    });
    return { kpis, revenueSeries: this.buildSeries(dayRev, periodDays) };
  }

  /** Compute KPIs + revenue chart for an explicit [from, to] date range (inclusive, YYYY-MM-DD). */
  private rangeMetrics(dayRev: Map<string, number>, dayOrd: Map<string, number>, from: string, to: string) {
    const DAYMS = 86_400_000;
    // Normalize order + parse to UTC midnight.
    let start = Date.parse(from + 'T00:00:00Z');
    let end = Date.parse(to + 'T00:00:00Z');
    if (isNaN(start) || isNaN(end)) return this.periodMetrics(dayRev, dayOrd, 30);
    if (start > end) [start, end] = [end, start];
    const spanDays = Math.round((end - start) / DAYMS) + 1;
    const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const sumRange = (map: Map<string, number>, s: number, e: number) => {
      let acc = 0;
      for (let ms = s; ms <= e; ms += DAYMS) acc += map.get(key(ms)) || 0;
      return acc;
    };
    // Previous comparison window = the same-length span immediately before `from`.
    const prevEnd = start - DAYMS;
    const prevStart = prevEnd - (spanDays - 1) * DAYMS;
    const revCur = sumRange(dayRev, start, end);
    const revPrev = sumRange(dayRev, prevStart, prevEnd);
    const ordCur = sumRange(dayOrd, start, end);
    const ordPrev = sumRange(dayOrd, prevStart, prevEnd);
    const vals: Record<string, [number, number]> = {
      revenue: [revCur, revPrev],
      orders: [ordCur, ordPrev],
      profit: [revCur * 0.36, revPrev * 0.36],
      aov: [ordCur ? revCur / ordCur : 0, ordPrev ? revPrev / ordPrev : 0],
    };
    const kpis = KPI_CONFIG.filter((c) => c.key in vals).map((c) => {
      const [v, p] = vals[c.key];
      const deltaPct = p ? Math.round(Math.abs((v - p) / p) * 100) : 0;
      return { key: c.key, label: c.label, value: c.fmt(v), delta: `${deltaPct}%`, kind: v >= p ? 'up' : 'down' };
    });
    return { kpis, revenueSeries: this.buildRangeSeries(dayRev, start, end, spanDays) };
  }

  /** Revenue chart for an explicit date range: daily points up to ~31 days, else weekly buckets. */
  private buildRangeSeries(dayRev: Map<string, number>, start: number, end: number, spanDays: number) {
    const DAYMS = 86_400_000;
    const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const md = (ms: number) => {
      const dt = new Date(ms);
      return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
    };
    const wd = (ms: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ms).getUTCDay()];
    const spanMs = spanDays * DAYMS;
    if (spanDays <= 31) {
      return Array.from({ length: spanDays }, (_, k) => {
        const ms = start + k * DAYMS;
        return { d: spanDays <= 7 ? wd(ms) : md(ms), rev: Math.round(dayRev.get(key(ms)) || 0), prev: Math.round(dayRev.get(key(ms - spanMs)) || 0) };
      });
    }
    const weeks = Math.ceil(spanDays / 7);
    return Array.from({ length: weeks }, (_, w) => {
      const wkStart = start + w * 7 * DAYMS;
      let rev = 0;
      let prev = 0;
      for (let d = 0; d < 7; d++) {
        const ms = wkStart + d * DAYMS;
        if (ms > end) break;
        rev += dayRev.get(key(ms)) || 0;
        prev += dayRev.get(key(ms - spanMs)) || 0;
      }
      return { d: md(wkStart), rev: Math.round(rev), prev: Math.round(prev) };
    });
  }

  private buildSeries(dayRev: Map<string, number>, periodDays: number) {
    const DAYMS = 86_400_000;
    const now = Date.now();
    const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const wd = (ms: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ms).getUTCDay()];
    const md = (ms: number) => {
      const dt = new Date(ms);
      return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
    };
    if (periodDays <= 30) {
      const n = periodDays;
      return Array.from({ length: n }, (_, k) => {
        const ms = now - (n - 1 - k) * DAYMS;
        return { d: n <= 7 ? wd(ms) : md(ms), rev: Math.round(dayRev.get(key(ms)) || 0), prev: Math.round(dayRev.get(key(ms - n * DAYMS)) || 0) };
      });
    }
    const weeks = Math.ceil(periodDays / 7);
    return Array.from({ length: weeks }, (_, w) => {
      const endMs = now - (weeks - 1 - w) * 7 * DAYMS;
      let rev = 0;
      let prev = 0;
      for (let d = 0; d < 7; d++) {
        rev += dayRev.get(key(endMs - d * DAYMS)) || 0;
        prev += dayRev.get(key(endMs - (d + periodDays) * DAYMS)) || 0;
      }
      return { d: md(endMs), rev: Math.round(rev), prev: Math.round(prev) };
    });
  }

  /** All products for a workspace (for the Products + Inventory tabs). */
  async getProducts(workspaceId: string = WORKSPACE_ID) {
    try {
      const products = await this.prisma.product.findMany({
        where: { workspaceId },
        orderBy: { revenue: 'desc' },
      });
      if (products.length) {
        return {
          source: 'live',
          products: products.map((p) => ({
            name: p.name,
            rev: `$${(p.revenue / 1000).toFixed(1)}k`,
            revenue: p.revenue,
            orders: p.orders,
            cr: p.conversionRt,
            trend: (p.aiScore ?? 0.5) >= 0.65 ? 'up' : (p.aiScore ?? 0.5) <= 0.35 ? 'down' : 'flat',
            stock: p.stock,
          })),
        };
      }
    } catch {
      /* fall through to mock */
    }
    return { source: 'mock', products: this.getMockOverview().topProducts };
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
