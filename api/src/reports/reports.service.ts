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
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Palette
      const PURPLE = '#5b5bd6';
      const PURPLE_LT = '#eef0fd';
      const INK = '#1f2430';
      const DIM = '#6b7280';
      const LINE = '#e6e8ef';
      const ROW_ALT = '#fafbfe';
      const GREEN = '#0a8f5b';
      const RED = '#d14343';

      const M = 50;
      const PAGE_W = doc.page.width;
      const PAGE_H = doc.page.height;
      const CW = PAGE_W - M * 2;
      const BOTTOM = PAGE_H - 58;
      const ensure = (h: number) => { if (doc.y + h > BOTTOM) doc.addPage(); };

      // --- Header band (page 1) ---
      doc.rect(0, 0, PAGE_W, 96).fill(PURPLE);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Growlytics AI', M, 30);
      doc.font('Helvetica').fontSize(10.5).fillColor('#e4e4fb').text('Performance Report', M, 56);
      // right-aligned store + meta
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff').text(data.store, PAGE_W / 2, 30, { width: CW / 2, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#e4e4fb')
        .text(data.period, PAGE_W / 2, 50, { width: CW / 2, align: 'right' })
        .text(`Generated ${new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, PAGE_W / 2, 63, { width: CW / 2, align: 'right' });
      doc.y = 120;

      // --- Reusable builders ---
      const sectionHeader = (title: string, tag?: string) => {
        ensure(40);
        doc.moveDown(0.6);
        const y = doc.y;
        doc.rect(M, y + 1, 3.5, 15).fill(PURPLE);
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(13.5).text(title, M + 11, y);
        if (tag) {
          doc.font('Helvetica').fontSize(8).fillColor(DIM)
            .text(tag, M, y + 2, { width: CW, align: 'right' });
        }
        doc.moveDown(0.7);
        doc.font('Helvetica').fillColor(INK);
      };

      const kpiCards = (kpis: KpiLine[]) => {
        if (!kpis.length) return;
        const cols = Math.min(3, kpis.length);
        const gap = 12;
        const cardW = (CW - gap * (cols - 1)) / cols;
        const cardH = 56;
        const rows = Math.ceil(kpis.length / cols);
        ensure(rows * (cardH + gap));
        const startY = doc.y;
        kpis.forEach((k, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const x = M + c * (cardW + gap);
          const y = startY + r * (cardH + gap);
          doc.lineWidth(1).roundedRect(x, y, cardW, cardH, 7).fillAndStroke('#ffffff', LINE);
          doc.fillColor(DIM).font('Helvetica').fontSize(7.5).text(k.label.toUpperCase(), x + 11, y + 10, { width: cardW - 22, characterSpacing: 0.3 });
          doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(k.value, x + 11, y + 21, { width: cardW - 22, ellipsis: true });
          doc.fillColor(k.kind === 'up' ? GREEN : RED).font('Helvetica').fontSize(8.5)
            .text(`${k.kind === 'up' ? '▲' : '▼'} ${k.delta}`, x + 11, y + 41);
        });
        doc.y = startY + rows * (cardH + gap) + 2;
        doc.fillColor(INK);
      };

      const table = (headers: string[], widths: number[], aligns: ('left' | 'right')[], rows: string[][]) => {
        const rowH = 20;
        const drawHead = () => {
          ensure(rowH * 2);
          const y = doc.y;
          doc.rect(M, y, CW, rowH).fill(PURPLE_LT);
          let x = M;
          doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(8).strokeColor(PURPLE_LT);
          headers.forEach((h, i) => {
            doc.text(h.toUpperCase(), x + 7, y + 6.5, { width: widths[i] - 12, align: aligns[i], characterSpacing: 0.2 });
            x += widths[i];
          });
          doc.y = y + rowH;
        };
        drawHead();
        rows.forEach((row, ri) => {
          if (doc.y + rowH > BOTTOM) { doc.addPage(); drawHead(); }
          const y = doc.y;
          if (ri % 2 === 1) doc.rect(M, y, CW, rowH).fill(ROW_ALT);
          let x = M;
          doc.font('Helvetica').fontSize(8.8).fillColor(INK);
          row.forEach((cell, ci) => {
            doc.fillColor(ci === 0 ? INK : '#3a4150')
              .text(cell, x + 7, y + 6.5, { width: widths[ci] - 12, align: aligns[ci], ellipsis: true });
            x += widths[ci];
          });
          doc.y = y + rowH;
        });
        doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(0.6).strokeColor(LINE).stroke();
        doc.moveDown(0.3);
      };

      // --- Sections ---
      if (data.revenue) {
        sectionHeader('Revenue & Overview', data.source === 'live' ? 'Live store data' : 'Sample data');
        kpiCards(data.revenue.kpis);
        doc.moveDown(0.3);
        ensure(60);
        doc.fillColor('#3a4150').font('Helvetica').fontSize(10).text(data.revenue.narrative, M, doc.y, { width: CW, lineGap: 3, align: 'justify' });
        if (data.revenue.insights.length) {
          doc.moveDown(0.7);
          ensure(30);
          doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text('AI Recommendations', M, doc.y);
          doc.moveDown(0.4);
          data.revenue.insights.forEach((ins) => {
            ensure(34);
            const y = doc.y;
            doc.circle(M + 3, y + 5, 2).fill(PURPLE);
            doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(ins.title, M + 12, y, { width: CW - 12 });
            doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(ins.body, M + 12, doc.y, { width: CW - 12, lineGap: 1.5 });
            doc.moveDown(0.5);
          });
        }
      }

      if (data.products) {
        sectionHeader('Top Products');
        table(
          ['Product', 'Revenue', 'Orders', 'CR %', 'Stock'],
          [205, 95, 70, 55, 70],
          ['left', 'right', 'right', 'right', 'right'],
          data.products.items.map((p) => [p.name, p.rev, String(p.orders), String(p.cr), p.stock < 0 ? 'In stock' : p.stock === 0 ? 'Out of stock' : String(p.stock)]),
        );
      }

      if (data.seo) {
        sectionHeader('SEO — Search Console', data.seo.source === 'live' ? 'Live Search Console' : 'Sample data');
        kpiCards(data.seo.kpis);
        doc.moveDown(0.3);
        table(
          ['Keyword', 'Clicks', 'CTR %', 'Avg Position'],
          [245, 80, 70, 100],
          ['left', 'right', 'right', 'right'],
          data.seo.keywords.map((k) => [k.query, k.clicks.toLocaleString('en-US'), String(k.ctr), String(k.position)]),
        );
      }

      if (data.marketing) {
        sectionHeader('Marketing — Channels', data.marketing.source === 'live' ? 'Live data' : 'Sample data');
        kpiCards(data.marketing.kpis);
        doc.moveDown(0.3);
        table(
          ['Channel', 'Spend', 'Revenue', 'ROAS', 'Conv.'],
          [150, 90, 100, 75, 80],
          ['left', 'right', 'right', 'right', 'right'],
          data.marketing.channels.map((c) => [c.name, c.spend, c.rev, c.roas, String(c.conv)]),
        );
      }

      // --- Footer on every page ---
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const y = PAGE_H - 42;
        doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.fillColor(DIM).font('Helvetica').fontSize(7.5)
          .text('Growlytics AI — Your AI Co-Pilot for Smarter E-commerce Growth', M, y + 7, { width: CW, align: 'left' });
        doc.text(`Page ${i + 1} of ${range.count}`, M, y + 7, { width: CW, align: 'right' });
      }

      doc.end();
    });
  }
}
