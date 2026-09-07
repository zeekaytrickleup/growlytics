import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [InsightsModule],
  controllers: [ReportsController],
  providers: [ReportsService, DashboardService],
})
export class ReportsModule {}
