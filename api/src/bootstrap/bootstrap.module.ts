import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [InsightsModule],
  providers: [SeedService],
})
export class BootstrapModule {}
