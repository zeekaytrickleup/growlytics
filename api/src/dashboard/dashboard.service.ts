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
  { key: 'aov', label: 'Avg Order Value', fmt: (v) => `$${v.toFixed(2)}` },
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

  /** Marketing-channel performance for the Marketing tab (live from mkt_* metrics, else mock). */
  async getMarketing(workspaceId: string = WORKSPACE_ID) {
    try {
      const metrics = await this.prisma.metricSnapshot.findMany({
        where: { workspaceId, metric: { in: ['mkt_spend', 'mkt_rev', 'mkt_conv', 'mkt_clicks', 'mkt_impr'] } },
      });
      if (metrics.length) {
        // Group by channel (dimension).
        const byChannel = new Map<string, { spend: number; rev: number; conv: number; clicks: number; impr: number }>();
        const field: Record<string, keyof NonNullable<ReturnType<typeof byChannel.get>>> = {
          mkt_spend: 'spend', mkt_rev: 'rev', mkt_conv: 'conv', mkt_clicks: 'clicks', mkt_impr: 'impr',
        };
        for (const m of metrics) {
          const ch = m.dimension ?? 'Other';
          const row = byChannel.get(ch) ?? { spend: 0, rev: 0, conv: 0, clicks: 0, impr: 0 };
          const key = field[m.metric];
          if (key) row[key] = m.value;
          byChannel.set(ch, row);
        }
        const money = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);
        const channels = Array.from(byChannel.entries())
          .map(([name, r]) => ({
            name,
            spend: money(r.spend),
            rev: money(r.rev),
            roas: r.spend ? `${(r.rev / r.spend).toFixed(1)}x` : '∞',
            cpa: r.conv ? `$${(r.spend / r.conv).toFixed(0)}` : '$0',
            ctr: r.impr ? `${((r.clicks / r.impr) * 100).toFixed(1)}%` : '0%',
            conv: Math.round(r.conv),
            kind: 'up',
            rec: 'Scale flows',
            _rev: r.rev, _spend: r.spend, _conv: r.conv,
          }))
          .sort((a, b) => b._rev - a._rev);

        const totalSpend = channels.reduce((s, c) => s + c._spend, 0);
        const totalRev = channels.reduce((s, c) => s + c._rev, 0);
        const totalConv = channels.reduce((s, c) => s + c._conv, 0);
        const kpis = [
          { key: 'spend', label: 'Total Spend', value: money(totalSpend), delta: '0%', kind: 'up' },
          { key: 'attrRev', label: 'Attributed Revenue', value: money(totalRev), delta: '0%', kind: 'up' },
          { key: 'roas', label: 'Blended ROAS', value: totalSpend ? `${(totalRev / totalSpend).toFixed(1)}x` : '∞', delta: '0%', kind: 'up' },
          { key: 'conv', label: 'Conversions', value: Math.round(totalConv).toLocaleString('en-US'), delta: '0%', kind: 'up' },
        ];
        return { source: 'live', kpis, channels: channels.map(({ _rev, _spend, _conv, ...c }) => c) };
      }
    } catch (err) {
      this.logger.warn(`Marketing fell back to mock: ${(err as Error).message}`);
    }
    return this.getMockMarketing();
  }

  /** Organic search performance for the SEO tab (live from seo_* metrics, else mock). */
  async getSeo(workspaceId: string = WORKSPACE_ID) {
    try {
      const metrics = await this.prisma.metricSnapshot.findMany({
        where: { workspaceId, metric: { startsWith: 'seo_' } },
      });
      if (metrics.length) {
        const agg = (metric: string) => {
          const m = new Map(metrics.filter((r) => r.metric === metric).map((r) => [r.dimension, r.value]));
          return {
            clicks: m.get('clicks') ?? 0, impressions: m.get('impressions') ?? 0,
            ctr: m.get('ctr') ?? 0, position: m.get('position') ?? 0,
          };
        };
        const cur = agg('seo_cur');
        const prev = agg('seo_prev');
        const delta = (c: number, p: number) => (p ? `${Math.round(Math.abs((c - p) / p) * 100)}%` : '0%');
        const fmtN = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);

        const kpis = [
          { key: 'clicks', label: 'Clicks', value: fmtN(cur.clicks), delta: delta(cur.clicks, prev.clicks), kind: cur.clicks >= prev.clicks ? 'up' : 'down' },
          { key: 'ctr', label: 'CTR', value: `${cur.ctr}%`, delta: delta(cur.ctr, prev.ctr), kind: cur.ctr >= prev.ctr ? 'up' : 'down' },
          { key: 'impressions', label: 'Impressions', value: fmtN(cur.impressions), delta: delta(cur.impressions, prev.impressions), kind: cur.impressions >= prev.impressions ? 'up' : 'down' },
          // Lower average position is better, so flip the arrow.
          { key: 'position', label: 'Avg Position', value: `${cur.position}`, delta: delta(cur.position, prev.position), kind: cur.position <= prev.position ? 'up' : 'down' },
        ];

        const chart = metrics
          .filter((r) => r.metric === 'seo_day')
          .sort((a, b) => (a.dimension ?? '').localeCompare(b.dimension ?? ''))
          .map((r) => ({ d: (r.dimension ?? '').slice(5), v: r.value })); // MM-DD

        const kwClicks = new Map(metrics.filter((r) => r.metric === 'seo_kw_clicks').map((r) => [r.dimension, r.value]));
        const kwCtr = new Map(metrics.filter((r) => r.metric === 'seo_kw_ctr').map((r) => [r.dimension, r.value]));
        const kwPos = new Map(metrics.filter((r) => r.metric === 'seo_kw_pos').map((r) => [r.dimension, r.value]));
        const keywords = Array.from(kwClicks.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([q, clicks]) => ({
            query: q ?? '', clicks: Math.round(clicks),
            ctr: kwCtr.get(q) ?? 0, position: kwPos.get(q) ?? 0,
          }));

        return { source: 'live', kpis, chart, keywords };
      }
    } catch (err) {
      this.logger.warn(`SEO fell back to mock: ${(err as Error).message}`);
    }
    return this.getMockSeo();
  }

  private getMockSeo() {
    return {
      source: 'mock',
      kpis: [
        { key: 'clicks', label: 'Clicks', value: '7.9k', delta: '22%', kind: 'up' },
        { key: 'ctr', label: 'CTR', value: '3.8%', delta: '5%', kind: 'up' },
        { key: 'impressions', label: 'Impressions', value: '208k', delta: '17%', kind: 'up' },
        { key: 'position', label: 'Avg Position', value: '8.4', delta: '1.2', kind: 'up' },
      ],
      chart: [] as { d: string; v: number }[],
      keywords: [
        { query: 'wireless earbuds', clicks: 1240, ctr: 4.1, position: 3.2 },
        { query: 'running hoodie', clicks: 890, ctr: 3.6, position: 5.8 },
        { query: 'smart water bottle', clicks: 610, ctr: 2.9, position: 9.1 },
        { query: 'desk lamp led', clicks: 540, ctr: 3.3, position: 6.4 },
      ],
    };
  }

  private getMockMarketing() {
    return {
      source: 'mock',
      kpis: [
        { key: 'spend', label: 'Total Spend', value: '$19.8k', delta: '4%', kind: 'up' },
        { key: 'attrRev', label: 'Attributed Revenue', value: '$91.8k', delta: '16%', kind: 'up' },
        { key: 'roas', label: 'Blended ROAS', value: '4.6x', delta: '8%', kind: 'up' },
        { key: 'conv', label: 'Conversions', value: '1,204', delta: '11%', kind: 'up' },
      ],
      channels: [
        { name: 'Google Ads', spend: '$8.2k', rev: '$34.1k', roas: '4.2x', cpa: '$12', ctr: '3.1%', conv: 812, kind: 'up', rec: 'Scale Shopping' },
        { name: 'Meta Ads', spend: '$6.9k', rev: '$19.8k', roas: '2.9x', cpa: '$18', ctr: '1.8%', conv: 540, kind: 'down', rec: 'Refresh creative' },
        { name: 'TikTok Ads', spend: '$3.1k', rev: '$11.4k', roas: '3.7x', cpa: '$14', ctr: '2.4%', conv: 288, kind: 'up', rec: 'Test UGC' },
        { name: 'Pinterest', spend: '$1.2k', rev: '$3.9k', roas: '3.3x', cpa: '$16', ctr: '1.5%', conv: 96, kind: 'up', rec: 'Hold' },
        { name: 'Email', spend: '$0.4k', rev: '$22.6k', roas: '56x', cpa: '$1', ctr: '6.2%', conv: 1120, kind: 'up', rec: 'Add flow' },
      ],
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
