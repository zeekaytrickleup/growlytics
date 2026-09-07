import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IngestionService } from '../connectors/ingestion.service';
import { ShopifyConnector } from '../connectors/shopify.connector';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [InsightsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IngestionService, ShopifyConnector],
})
export class IntegrationsModule {}
