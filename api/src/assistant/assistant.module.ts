import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AiService } from '../ai/ai.service';
import { DashboardService } from '../dashboard/dashboard.service';

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, AiService, DashboardService],
})
export class AssistantModule {}
