import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService, ReportOptions } from './reports.service';
import { Workspace } from '../auth/workspace.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Parse shared report options from query (?sections=revenue,products&period=30d&from=&to=).
  private opts(sections?: string, period?: string, from?: string, to?: string): ReportOptions {
    const valid = from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
    return {
      sections: sections ? sections.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      ...(valid ? { from, to } : { period }),
    };
  }

  @Get('summary')
  summary(
    @Workspace() workspaceId: string,
    @Query('sections') sections?: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.summary(workspaceId, this.opts(sections, period, from, to));
  }

  @Get('summary.pdf')
  async pdf(
    @Res() res: Response,
    @Workspace() workspaceId: string,
    @Query('sections') sections?: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const buffer = await this.reports.pdf(workspaceId, this.opts(sections, period, from, to));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="growlytics-report.pdf"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
