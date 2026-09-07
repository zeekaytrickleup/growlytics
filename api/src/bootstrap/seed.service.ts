import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Provider, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';

const DEMO_USER_EMAIL = 'demo@growlytics.ai';

type Dataset = {
  id: string;
  name: string;
  kpis: Record<string, { cur: number; prev: number }>;
  revenueSeries: { d: string; rev: number; prev: number }[];
  traffic: { name: string; value: number }[];
  products: { externalId: string; name: string; revenue: number; orders: number; conversionRt: number; stock: number; aiScore: number }[];
};

const SEGMENTS = [
  { name: 'VIP', color: 'var(--amber)' }, { name: 'Loyal', color: 'var(--emerald)' },
  { name: 'Repeat Buyers', color: 'var(--primary-2)' }, { name: 'One-Time', color: 'var(--blue)' },
  { name: 'Dormant', color: 'var(--mute)' }, { name: 'Churn Risk', color: 'var(--red)' },
];

const NORTHWIND: Dataset = {
  id: 'demo-workspace', name: 'Northwind Goods',
  kpis: { revenue: { cur: 81200, prev: 68814 }, orders: { cur: 1942, prev: 1782 }, profit: { cur: 29400, prev: 25789 }, roas: { cur: 3.8, prev: 4.32 }, aov: { cur: 41.8, prev: 40.6 }, cr: { cur: 3.4, prev: 3.21 }, ltv: { cur: 186, prev: 172 }, returning: { cur: 42, prev: 41.2 } },
  revenueSeries: [{ d: 'Mon', rev: 8200, prev: 7100 }, { d: 'Tue', rev: 9100, prev: 8300 }, { d: 'Wed', rev: 7600, prev: 8000 }, { d: 'Thu', rev: 11200, prev: 9200 }, { d: 'Fri', rev: 14800, prev: 10100 }, { d: 'Sat', rev: 16900, prev: 12400 }, { d: 'Sun', rev: 13400, prev: 11800 }],
  traffic: [{ name: 'Organic', value: 38 }, { name: 'Paid Ads', value: 29 }, { name: 'Email', value: 17 }, { name: 'Social', value: 11 }, { name: 'Direct', value: 5 }],
  products: [
    { externalId: 'p1', name: 'Aurora Wireless Buds', revenue: 48200, orders: 812, conversionRt: 4.8, stock: 340, aiScore: 0.9 },
    { externalId: 'p2', name: 'Nimbus Hoodie', revenue: 31700, orders: 640, conversionRt: 3.9, stock: 88, aiScore: 0.8 },
    { externalId: 'p3', name: 'Flux Smart Bottle', revenue: 22400, orders: 511, conversionRt: 3.1, stock: 12, aiScore: 0.2 },
    { externalId: 'p4', name: 'Lumen Desk Lamp', revenue: 18900, orders: 402, conversionRt: 2.7, stock: 205, aiScore: 0.75 },
    { externalId: 'p5', name: 'Terra Yoga Mat', revenue: 14100, orders: 388, conversionRt: 2.2, stock: 61, aiScore: 0.5 },
  ],
};

const AURORA: Dataset = {
  id: 'aurora-labs', name: 'Aurora Labs',
  kpis: { revenue: { cur: 142500, prev: 121000 }, orders: { cur: 3210, prev: 2980 }, profit: { cur: 51200, prev: 43800 }, roas: { cur: 5.1, prev: 4.6 }, aov: { cur: 44.4, prev: 40.6 }, cr: { cur: 4.1, prev: 3.8 }, ltv: { cur: 210, prev: 198 }, returning: { cur: 48, prev: 45 } },
  revenueSeries: [{ d: 'Mon', rev: 15200, prev: 13100 }, { d: 'Tue', rev: 17100, prev: 15300 }, { d: 'Wed', rev: 14600, prev: 14000 }, { d: 'Thu', rev: 20200, prev: 17200 }, { d: 'Fri', rev: 24800, prev: 19100 }, { d: 'Sat', rev: 28900, prev: 22400 }, { d: 'Sun', rev: 21700, prev: 19900 }],
  traffic: [{ name: 'Organic', value: 31 }, { name: 'Paid Ads', value: 34 }, { name: 'Email', value: 21 }, { name: 'Social', value: 9 }, { name: 'Direct', value: 5 }],
  products: [
    { externalId: 'a1', name: 'Halo Ring Light', revenue: 61200, orders: 1310, conversionRt: 5.2, stock: 420, aiScore: 0.92 },
    { externalId: 'a2', name: 'Pulse Smartwatch', revenue: 44800, orders: 740, conversionRt: 4.4, stock: 9, aiScore: 0.3 },
    { externalId: 'a3', name: 'Vega Mechanical Keyboard', revenue: 33500, orders: 610, conversionRt: 3.8, stock: 150, aiScore: 0.82 },
    { externalId: 'a4', name: 'Solace Candle Set', revenue: 21400, orders: 690, conversionRt: 3.0, stock: 260, aiScore: 0.55 },
    { externalId: 'a5', name: 'Drift Travel Backpack', revenue: 17600, orders: 402, conversionRt: 2.6, stock: 74, aiScore: 0.6 },
  ],
};

/**
 * Populates the demo data on first boot when the database is empty (idempotent). Lets a freshly
 * provisioned hosted DB (Neon) come up seeded without a separate `prisma db seed` step. Local dev
 * gets the same behavior; `npm run db:seed` remains for a manual reset.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.workspace.count();
      if (count > 0) return; // already seeded
      this.logger.log('Empty database — seeding demo data…');
      await this.seed();
      this.logger.log('Seed complete.');
    } catch (err) {
      this.logger.warn(`Seed skipped (no DB yet?): ${(err as Error).message}`);
    }
  }

  private async seedWorkspace(d: Dataset) {
    await this.prisma.workspace.upsert({ where: { id: d.id }, update: { name: d.name }, create: { id: d.id, name: d.name } });
    await this.prisma.metricSnapshot.deleteMany({ where: { workspaceId: d.id } });
    await this.prisma.insight.deleteMany({ where: { workspaceId: d.id } });
    await this.prisma.product.deleteMany({ where: { workspaceId: d.id } });
    await this.prisma.customer.deleteMany({ where: { workspaceId: d.id } });
    await this.prisma.segment.deleteMany({ where: { workspaceId: d.id } });

    const now = new Date();
    const kpiRows = Object.entries(d.kpis).flatMap(([key, v]) => [
      { workspaceId: d.id, source: Provider.SHOPIFY, metric: 'kpi', dimension: key, value: v.cur, ts: now },
      { workspaceId: d.id, source: Provider.SHOPIFY, metric: 'kpi_prev', dimension: key, value: v.prev, ts: now },
    ]);
    const revRows = d.revenueSeries.flatMap((r, i) => {
      const ts = new Date(now.getTime() - (d.revenueSeries.length - i) * 86_400_000);
      return [
        { workspaceId: d.id, source: Provider.SHOPIFY, metric: 'revenue', dimension: r.d, value: r.rev, ts },
        { workspaceId: d.id, source: Provider.SHOPIFY, metric: 'revenue_prev', dimension: r.d, value: r.prev, ts },
      ];
    });
    const trafficRows = d.traffic.map((t) => ({ workspaceId: d.id, source: Provider.GA4, metric: 'traffic', dimension: t.name, value: t.value, ts: now }));
    await this.prisma.metricSnapshot.createMany({ data: [...kpiRows, ...revRows, ...trafficRows] });
    await this.prisma.product.createMany({ data: d.products.map((p) => ({ ...p, workspaceId: d.id })) });
    for (const s of SEGMENTS) await this.prisma.segment.create({ data: { ...s, workspaceId: d.id } });
  }

  private async seed() {
    for (const d of [NORTHWIND, AURORA]) {
      await this.seedWorkspace(d);
      await this.insights.generate(d.id).catch(() => undefined);
    }
    const user = await this.prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: { name: 'Demo User' },
      create: { email: DEMO_USER_EMAIL, name: 'Demo User' },
    });
    for (const wsId of [NORTHWIND.id, AURORA.id]) {
      await this.prisma.membership.upsert({
        where: { userId_workspaceId: { userId: user.id, workspaceId: wsId } },
        update: { role: Role.OWNER },
        create: { userId: user.id, workspaceId: wsId, role: Role.OWNER },
      });
    }
  }
}
