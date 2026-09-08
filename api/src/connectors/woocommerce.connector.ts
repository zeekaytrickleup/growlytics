import { Injectable, Logger } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { Connector, SyncResult, NormalizedProduct, NormalizedKpi } from './connector.interface';

type WooOrder = { total: string; status: string; date_created_gmt?: string; date_created?: string };
type WooProduct = {
  id: number;
  name: string;
  price: string;
  regular_price?: string;
  stock_quantity: number | null;
  manage_stock?: boolean;
  stock_status?: string; // instock | outofstock | onbackorder
  total_sales: number;
};

const DAY = 86_400_000;

/**
 * WooCommerce connector — pulls live products + orders via the WooCommerce REST API and maps them
 * into the normalized shapes. Reads credentials from env (set on the host, never in code):
 *   WOO_STORE_URL, WOO_CONSUMER_KEY, WOO_CONSUMER_SECRET
 * The store must be reachable over public HTTPS.
 */
@Injectable()
export class WooCommerceConnector implements Connector {
  readonly provider = Provider.WOOCOMMERCE;
  readonly label = 'WooCommerce';
  private readonly logger = new Logger(WooCommerceConnector.name);

  get configured(): boolean {
    return !!(process.env.WOO_STORE_URL && process.env.WOO_CONSUMER_KEY && process.env.WOO_CONSUMER_SECRET);
  }

  private base(): string {
    return (process.env.WOO_STORE_URL || '').trim().replace(/\/+$/, '');
  }

  private async get(path: string, params: Record<string, string | number>): Promise<unknown[]> {
    const url = new URL(`${this.base()}/wp-json/wc/v3/${path}`);
    url.searchParams.set('consumer_key', process.env.WOO_CONSUMER_KEY || '');
    url.searchParams.set('consumer_secret', process.env.WOO_CONSUMER_SECRET || '');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WooCommerce ${path} returned ${res.status}: ${body.slice(0, 160)}`);
    }
    return (await res.json()) as unknown[];
  }

  private async fetchAll(path: string, params: Record<string, string | number>, maxPages = 5): Promise<unknown[]> {
    const all: unknown[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const rows = await this.get(path, { ...params, per_page: 100, page });
      all.push(...rows);
      if (rows.length < 100) break;
    }
    return all;
  }

  /** Compute customer segments from actual orders (grouped by buyer email — captures guests too). */
  async customerSegments() {
    const orders = (await this.fetchAll('orders', { status: 'any', orderby: 'date', order: 'desc' })) as {
      status: string;
      total: string;
      billing?: { email?: string };
    }[];
    const paid = orders.filter((o) => ['completed', 'processing', 'on-hold'].includes(o.status));

    const byEmail = new Map<string, { orders: number; spent: number }>();
    for (const o of paid) {
      const email = (o.billing?.email || '').trim().toLowerCase();
      if (!email) continue;
      const e = byEmail.get(email) || { orders: 0, spent: 0 };
      e.orders += 1;
      e.spent += parseFloat(o.total) || 0;
      byEmail.set(email, e);
    }

    const buckets: Record<string, { n: number; ltv: number }> = {
      VIP: { n: 0, ltv: 0 },
      Loyal: { n: 0, ltv: 0 },
      'Repeat Buyers': { n: 0, ltv: 0 },
      'One-Time': { n: 0, ltv: 0 },
    };
    for (const c of byEmail.values()) {
      const key = c.spent >= 200 ? 'VIP' : c.orders >= 3 ? 'Loyal' : c.orders === 2 ? 'Repeat Buyers' : 'One-Time';
      buckets[key].n += 1;
      buckets[key].ltv += c.spent;
    }

    const meta: Record<string, { color: string; ai: string }> = {
      VIP: { color: 'var(--amber)', ai: 'Offer early access' },
      Loyal: { color: 'var(--emerald)', ai: 'Referral program' },
      'Repeat Buyers': { color: 'var(--primary-2)', ai: 'Cross-sell bundles' },
      'One-Time': { color: 'var(--blue)', ai: 'Welcome flow #2' },
    };
    const fmt = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);
    return Object.entries(buckets).map(([name, b]) => ({
      name,
      n: b.n,
      val: fmt(b.ltv),
      color: meta[name].color,
      ai: meta[name].ai,
    }));
  }

  async sync(): Promise<SyncResult> {
    if (!this.configured) {
      throw new Error('WooCommerce not configured — set WOO_STORE_URL, WOO_CONSUMER_KEY, WOO_CONSUMER_SECRET.');
    }
    const now = Date.now();
    const after = new Date(now - 180 * DAY).toISOString(); // 180d history for period filtering

    const [ordersRaw, productsRaw] = await Promise.all([
      this.fetchAll('orders', { after, status: 'any', orderby: 'date', order: 'desc' }) as Promise<WooOrder[]>,
      this.fetchAll('products', { status: 'publish', orderby: 'popularity' }) as Promise<WooProduct[]>,
    ]);

    // Paid orders only, parsed to { total, timestamp, day }.
    const rows = ordersRaw
      .filter((o) => ['completed', 'processing', 'on-hold'].includes(o.status))
      .map((o) => {
        const iso = o.date_created_gmt || o.date_created || '';
        return { t: parseFloat(o.total) || 0, ts: Date.parse(iso.endsWith('Z') ? iso : iso + 'Z'), day: iso.slice(0, 10) };
      })
      .filter((r) => r.day && !Number.isNaN(r.ts));

    const sum = (arr: { t: number }[]) => arr.reduce((s, r) => s + r.t, 0);
    const inWindow = (fromAgo: number, toAgo: number) => rows.filter((r) => r.ts >= now - fromAgo && r.ts < now - toAgo);

    const cur = inWindow(30 * DAY, 0);
    const prev = inWindow(60 * DAY, 30 * DAY);
    const revCur = sum(cur);
    const revPrev = sum(prev);
    const aov = (rev: number, n: number) => (n ? +(rev / n).toFixed(1) : 0);

    const kpis: NormalizedKpi[] = [
      { key: 'revenue', cur: Math.round(revCur), prev: Math.round(revPrev) },
      { key: 'orders', cur: cur.length, prev: prev.length },
      { key: 'profit', cur: Math.round(revCur * 0.36), prev: Math.round(revPrev * 0.36) },
      { key: 'aov', cur: aov(revCur, cur.length), prev: aov(revPrev, prev.length) },
    ];

    // Daily revenue: last 7 days, with the same weekday one week earlier as the "prev" line.
    const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const wd = (ms: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ms).getUTCDay()];
    const byDay = new Map<string, number>();
    const byDayCount = new Map<string, number>();
    for (const r of rows) {
      byDay.set(r.day, (byDay.get(r.day) || 0) + r.t);
      byDayCount.set(r.day, (byDayCount.get(r.day) || 0) + 1);
    }
    const revenueSeries = Array.from({ length: 7 }, (_, k) => {
      const ms = now - (6 - k) * DAY;
      return { d: wd(ms), rev: Math.round(byDay.get(dayKey(ms)) || 0), prev: Math.round(byDay.get(dayKey(ms - 7 * DAY)) || 0) };
    });

    // 180 days of daily revenue + order counts (for the dashboard period filter).
    const dailySeries = Array.from({ length: 180 }, (_, k) => {
      const ms = now - (179 - k) * DAY;
      const key = dayKey(ms);
      return { date: key, rev: Math.round(byDay.get(key) || 0), orders: byDayCount.get(key) || 0 };
    });

    // Products — top by lifetime units sold; aiScore scaled from sales for the trending/restock rules.
    const maxSales = Math.max(1, ...productsRaw.map((p) => p.total_sales || 0));
    const products: NormalizedProduct[] = productsRaw
      .map((p) => {
        const price = parseFloat(p.price) || parseFloat(p.regular_price || '') || 0;
        const sales = p.total_sales || 0;
        // Tracked quantity when the store manages stock; else -1 = "in stock, untracked", 0 = out.
        const stock =
          p.manage_stock && typeof p.stock_quantity === 'number'
            ? p.stock_quantity
            : p.stock_status === 'outofstock'
              ? 0
              : -1;
        return {
          externalId: `woo-${p.id}`,
          name: p.name,
          revenue: Math.round(sales * price),
          orders: sales,
          conversionRt: 0,
          stock,
          aiScore: Math.min(0.95, 0.3 + 0.6 * (sales / maxSales)),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    this.logger.log(`WooCommerce sync: ${products.length} products, ${rows.length} paid orders (180d).`);
    return { products, kpis, revenueSeries, dailySeries };
  }
}
