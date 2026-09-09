import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Workspace } from '../auth/workspace.decorator';

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  getOverview(
    @Workspace() workspaceId: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // A valid from+to custom range takes precedence over the preset period.
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return this.dashboard.getOverview(workspaceId, { from, to });
    }
    const days = PERIOD_DAYS[period ?? '30d'] ?? 30;
    return this.dashboard.getOverview(workspaceId, { days });
  }

  @Get('products')
  getProducts(@Workspace() workspaceId: string) {
    return this.dashboard.getProducts(workspaceId);
  }
}
