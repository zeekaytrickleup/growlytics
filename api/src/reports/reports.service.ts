import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { DashboardService } from '../dashboard/dashboard.service';
import { InsightsService } from '../insights/insights.service';
import { PrismaService } from '../prisma/prisma.service';

const WORKSPACE_ID = 'demo-workspace';
const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
export const ALL_SECTIONS = ['revenue', 'products', 'seo', 'marketing'] as const;
export type ReportSection = (typeof ALL_SECTIONS)[number];

export interface ReportOptions {
  sections?: string[];
  period?: string;
  from?: string;
  to?: string;
}

interface KpiLine { label: string; value: string; delta: string; kind: string }

export interface ReportResult {
  store: string;
  period: string;
  generatedAt: string;
  source: string;
  sections: ReportSection[];
  revenue?: { kpis: KpiLine[]; narrative: string; insights: { title: string; body: string; confidence: number }[] };
  products?: { items: { name: string; rev: string; orders: number; cr: number; stock: number }[] };
  seo?: { source: string; kpis: KpiLine[]; keywords: { query: string; clicks: number; ctr: number; position: number }[] };
  marketing?: { source: string; kpis: KpiLine[]; channels: { name: string; spend: string; rev: string; roas: string; conv: number }[] };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly insights: InsightsService,
    private readonly prisma: PrismaService,
  ) {}

  private periodLabel(opts: ReportOptions): string {
    if (opts.from && opts.to) return `${opts.from} → ${opts.to}`;
    const p = opts.period ?? '30d';
    return p === '7d' ? 'Last 7 days' : p === '90d' ? 'Last 90 days' : 'Last 30 days';
  }

  private overviewOpts(opts: ReportOptions) {
    if (opts.from && opts.to) return { from: opts.from, to: opts.to };
    return { days: PERIOD_DAYS[opts.period ?? '30d'] ?? 30 };
  }

  async summary(workspaceId: string = WORKSPACE_ID, opts: ReportOptions = {}): Promise<ReportResult> {
    const requested = (opts.sections?.length ? opts.sections : [...ALL_SECTIONS]).filter((s): s is ReportSection =>
      (ALL_SECTIONS as readonly string[]).includes(s),
    );
    const want = new Set<ReportSection>(requested.length ? requested : [...ALL_SECTIONS]);

    let store = 'Northwind Goods';
    try {
      const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (ws) store = ws.name;
    } catch {
      /* keep default */
    }

    // Overview drives the "source" label + the revenue section.
    const overview = await this.dashboard.getOverview(workspaceId, this.overviewOpts(opts));
    const result: ReportResult = {
      store,
      period: this.periodLabel(opts),
      generatedAt: new Date().toISOString(),
      source: overview.source,
      sections: [...want],
    };

    if (want.has('revenue')) {
      let insightRows: { title: string; body: string; confidence: number }[] = [];
      try {
        const { insights } = await this.insights.list(workspaceId);
        insightRows = insights.map((i) => ({ title: i.title, body: i.body, confidence: i.confidence }));
      } catch {
        insightRows = overview.insights.map((i) => ({ title: i.title, body: i.body, confidence: 0 }));
      }
      const kpi = (k: string) => overview.kpis.find((x) => x.key === k);
      const rev = kpi('revenue');
      const profit = kpi('profit');
      const top = overview.topProducts[0]?.name ?? 'the top product';
      const lowStock = overview.topProducts.find((p) => p.stock >= 0 && p.stock < 20);
      const narrative =
        `Over ${result.period.toLowerCase()}, revenue was ${rev?.value ?? '—'} (${rev?.kind === 'up' ? '+' : '-'}${rev?.delta ?? ''}) ` +
        `with net profit at ${profit?.value ?? '—'}. ${top} led on sales` +
        `${lowStock ? `, and ${lowStock.name} is low on stock (${lowStock.stock} units left)` : ''}. ` +
        `${insightRows.length} AI insight${insightRows.length === 1 ? '' : 's'} with recommended actions are included below.`;
      result.revenue = {
        kpis: overview.kpis.slice(0, 6).map((k) => ({ label: k.label, value: k.value, delta: k.delta, kind: k.kind })),
        narrative,
        insights: insightRows,
      };
    }

    if (want.has('products')) {
      const { products } = await this.dashboard.getProducts(workspaceId);
      result.products = {
        items: products.slice(0, 10).map((p) => ({ name: p.name, rev: p.rev, orders: p.orders, cr: p.cr, stock: p.stock })),
      };
    }

    if (want.has('seo')) {
      const seo = await this.dashboard.getSeo(workspaceId);
      result.seo = {
        source: seo.source,
        kpis: seo.kpis.map((k) => ({ label: k.label, value: k.value, delta: k.delta, kind: k.kind })),
        keywords: seo.keywords.slice(0, 10),
      };
    }

    if (want.has('marketing')) {
      const mkt = await this.dashboard.getMarketing(workspaceId);
      result.marketing = {
        source: mkt.source,
        kpis: mkt.kpis.map((k) => ({ label: k.label, value: k.value, delta: k.delta, kind: k.kind })),
        channels: mkt.channels.map((c) => ({ name: c.name, spend: c.spend, rev: c.rev, roas: c.roas, conv: c.conv })),
      };
    }

    return result;
  }

  async pdf(workspaceId: string = WORKSPACE_ID, opts: ReportOptions = {}): Promise<Buffer> {
    const data = await this.summary(workspaceId, opts);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const purple = '#5b5bd6';
      const dim = '#555';
      const heading = (t: string) => {
        doc.moveDown(0.8);
        doc.fillColor('#111').fontSize(13).text(t);
        doc.moveDown(0.4);
      };
      const kpiGrid = (kpis: KpiLine[]) => {
        const startY = doc.y;
        const colW = 165;
        kpis.forEach((k, i) => {
          const x = 50 + (i % 3) * colW;
          const y = startY + Math.floor(i / 3) * 58;
          doc.fillColor(dim).fontSize(9).text(k.label.toUpperCase(), x, y, { width: colW - 6 });
          doc.fillColor('#111').fontSize(17).text(k.value, x, y + 12);
          doc.fillColor(k.kind === 'up' ? '#0a8' : '#c33').fontSize(9).text(`${k.kind === 'up' ? '+' : '-'}${k.delta}`, x, y + 33);
        });
        doc.y = startY + Math.ceil(kpis.length / 3) * 58 + 6;
      };
      const row = (cols: string[], widths: number[], bold = false) => {
        const y = doc.y;
        let x = 50;
        doc.fontSize(9.5).fillColor(bold ? '#111' : '#333');
        cols.forEach((c, i) => { doc.text(c, x, y, { width: widths[i] - 6, ellipsis: true }); x += widths[i]; });
        doc.y = y + 15;
      };

      // Header
      doc.fillColor(purple).fontSize(22).text('Growlytics AI', { continued: true }).fillColor('#111').text('  Report');
      doc.moveDown(0.2);
      doc.fillColor(dim).fontSize(10).text(`${data.store} · ${data.period} · Generated ${new Date(data.generatedAt).toLocaleString('en-US')}`);
      doc.moveTo(50, doc.y + 8).lineTo(545, doc.y + 8).strokeColor('#ddd').stroke();

      if (data.revenue) {
        heading('Revenue & Overview');
        kpiGrid(data.revenue.kpis);
        doc.fillColor('#333').fontSize(10.5).text(data.revenue.narrative, { lineGap: 3 });
        if (data.revenue.insights.length) {
          doc.moveDown(0.6);
          doc.fillColor('#111').fontSize(11).text('AI recommendations');
          doc.moveDown(0.3);
          data.revenue.insights.forEach((ins) => {
            doc.fillColor(purple).fontSize(10.5).text(`• ${ins.title}`);
            doc.fillColor('#444').fontSize(9.5).text(ins.body, { indent: 12, lineGap: 2 });
            doc.moveDown(0.3);
          });
        }
      }

      if (data.products) {
        heading('Top Products');
        const w = [210, 90, 70, 60, 60];
        row(['Product', 'Revenue', 'Orders', 'CR %', 'Stock'], w, true);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eee').stroke();
        doc.moveDown(0.2);
        data.products.items.forEach((p) =>
          row([p.name, p.rev, String(p.orders), String(p.cr), p.stock < 0 ? 'In stock' : String(p.stock)], w),
        );
      }

      if (data.seo) {
        heading(`SEO — Search Console${data.seo.source === 'live' ? '' : ' (sample)'}`);
        kpiGrid(data.seo.kpis);
        const w = [260, 80, 70, 80];
        row(['Keyword', 'Clicks', 'CTR %', 'Position'], w, true);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eee').stroke();
        doc.moveDown(0.2);
        data.seo.keywords.forEach((k) => row([k.query, String(k.clicks), String(k.ctr), String(k.position)], w));
      }

      if (data.marketing) {
        heading(`Marketing — Channels${data.marketing.source === 'live' ? '' : ' (sample)'}`);
        kpiGrid(data.marketing.kpis);
        const w = [150, 90, 100, 70, 80];
        row(['Channel', 'Spend', 'Revenue', 'ROAS', 'Conv.'], w, true);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eee').stroke();
        doc.moveDown(0.2);
        data.marketing.channels.forEach((c) => row([c.name, c.spend, c.rev, c.roas, String(c.conv)], w));
      }

      doc.moveDown(1.2);
      doc.fillColor('#999').fontSize(8).text(`Data source: ${data.source} · Growlytics AI — Your AI Co-Pilot for Smarter E-commerce Growth`, { align: 'center' });
      doc.end();
    });
  }
}
