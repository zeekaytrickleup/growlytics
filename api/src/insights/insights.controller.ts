import { Controller, Get, Post } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { Workspace } from '../auth/workspace.decorator';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  list(@Workspace() workspaceId: string) {
    return this.insights.list(workspaceId);
  }

  @Post('generate')
  generate(@Workspace() workspaceId: string) {
    return this.insights.generate(workspaceId);
  }
}
