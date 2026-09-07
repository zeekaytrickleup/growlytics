import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { Workspace } from '../auth/workspace.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@Workspace() workspaceId: string) {
    return this.reports.summary(workspaceId);
  }

  @Get('summary.pdf')
  async pdf(@Res() res: Response, @Workspace() workspaceId: string) {
    const buffer = await this.reports.pdf(workspaceId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="growlytics-executive-summary.pdf"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
