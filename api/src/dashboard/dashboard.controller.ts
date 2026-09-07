import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Workspace } from '../auth/workspace.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  getOverview(@Workspace() workspaceId: string) {
    return this.dashboard.getOverview(workspaceId);
  }
}
