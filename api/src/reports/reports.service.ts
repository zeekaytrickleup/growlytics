import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { DashboardService } from '../dashboard/dashboard.service';
import { InsightsService } from '../insights/insights.service';
import { PrismaService } from '../prisma/prisma.service';

const WORKSPACE_ID = 'demo-workspace';

export interface ReportSummary {
  store: string;
  period: string;
  generatedAt: string;
  headlineKpis: { label: string; value: string; delta: string; kind: string }[];
  narrative: string;
  insights: { title: string; body: string; confidence: number }[];
  source: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly insights: InsightsService,
    private readonly prisma: PrismaService,
  ) {}

  async summary(workspaceId: string = WORKSPACE_ID): Promise<ReportSummary> {
    const overview = await this.dashboard.getOverview(workspaceId);
    let insightRows: { title: string; body: string; confidence: number }[] = [];
    let store = 'Northwind Goods';
    try {
      const [{ insights }, ws] = await Promise.all([
        this.insights.list(workspaceId),
        this.prisma.workspace.findUnique({ where: { id: workspaceId } }),
      ]);
      insightRows = insights.map((i) => ({ title: i.title, body: i.body, confidence: i.confidence }));
      if (ws) store = ws.name;
    } catch {
      insightRows = overview.insights.map((i) => ({ title: i.title, body: i.body, confidence: 0 }));
    }

    const kpi = (k: string) => overview.kpis.find((x) => x.key === k);
    const rev = kpi('revenue');
    const profit = kpi('profit');
    const roas = kpi('roas');
    const top = overview.topProducts[0]?.name ?? 'the top product';
    const lowStock = overview.topProducts.find((p) => p.stock < 20);

    const narrative =
      `Revenue reached ${rev?.value ?? '—'} (${rev?.kind === 'up' ? '+' : '-'}${rev?.delta ?? ''}) for the ${overview.source === 'live' ? 'connected' : 'sample'} period, ` +
      `with net profit at ${profit?.value ?? '—'}. Blended ROAS held at ${roas?.value ?? '—'}. ` +
      `${top} was the standout product${lowStock ? `, while ${lowStock.name} needs a restock (${lowStock.stock} units left)` : ''}. ` +
      `${insightRows.length} AI insight${insightRows.length === 1 ? '' : 's'} were generated with recommended next actions.`;

    return {
      store,
      period: 'Last 30 days',
      generatedAt: new Date().toISOString(),
      headlineKpis: overview.kpis.slice(0, 6).map((k) => ({ label: k.label, value: k.value, delta: k.delta, kind: k.kind })),
      narrative,
      insights: insightRows,
      source: overview.source,
    };
  }

  async pdf(workspaceId: string = WORKSPACE_ID): Promise<Buffer> {
    const data = await this.summary(workspaceId);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const purple = '#5b5bd6';
      const dim = '#555';

      // Header
      doc.fillColor(purple).fontSize(22).text('Growlytics AI', { continued: true }).fillColor('#111').text('  Executive Summary');
      doc.moveDown(0.2);
      doc.fillColor(dim).fontSize(10).text(`${data.store} · ${data.period} · Generated ${new Date(data.generatedAt).toLocaleString('en-US')}`);
      doc.moveTo(50, doc.y + 8).lineTo(545, doc.y + 8).strokeColor('#ddd').stroke();
      doc.moveDown(1.2);

      // KPI grid
      doc.fillColor('#111').fontSize(13).text('Key Metrics');
      doc.moveDown(0.5);
      const startY = doc.y;
      const colW = 165;
      data.headlineKpis.forEach((k, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 50 + col * colW;
        const y = startY + row * 60;
        doc.fillColor(dim).fontSize(9).text(k.label.toUpperCase(), x, y);
        doc.fillColor('#111').fontSize(18).text(k.value, x, y + 12);
        doc.fillColor(k.kind === 'up' ? '#0a8' : '#c33').fontSize(9).text(`${k.kind === 'up' ? '+' : '-'}${k.delta}`, x, y + 34);
      });
      doc.y = startY + Math.ceil(data.headlineKpis.length / 3) * 60 + 10;

      // Narrative
      doc.fillColor('#111').fontSize(13).text('Summary');
      doc.moveDown(0.4);
      doc.fillColor('#333').fontSize(10.5).text(data.narrative, { align: 'left', lineGap: 3 });
      doc.moveDown(1);

      // Insights
      doc.fillColor('#111').fontSize(13).text('AI Recommendations');
      doc.moveDown(0.4);
      data.insights.forEach((ins) => {
        doc.fillColor(purple).fontSize(11).text(`• ${ins.title}`, { continued: ins.confidence > 0 });
        if (ins.confidence > 0) doc.fillColor(dim).fontSize(9).text(`   (${ins.confidence}% confidence)`);
        doc.fillColor('#444').fontSize(10).text(ins.body, { indent: 12, lineGap: 2 });
        doc.moveDown(0.5);
      });

      doc.moveDown(1);
      doc.fillColor('#999').fontSize(8).text(`Data source: ${data.source} · Growlytics AI — Your AI Co-Pilot for Smarter E-commerce Growth`, { align: 'center' });

      doc.end();
    });
  }
}
