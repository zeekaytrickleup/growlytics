import { Controller, Get, Param, Post } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { Workspace } from '../auth/workspace.decorator';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  list(@Workspace() workspaceId: string) {
    return this.integrations.list(workspaceId);
  }

  @Post(':provider/connect')
  connect(@Param('provider') provider: string, @Workspace() workspaceId: string) {
    return this.integrations.connect(provider, workspaceId);
  }

  @Post(':provider/sync')
  sync(@Param('provider') provider: string, @Workspace() workspaceId: string) {
    return this.integrations.sync(provider, workspaceId);
  }

  @Post(':provider/disconnect')
  disconnect(@Param('provider') provider: string, @Workspace() workspaceId: string) {
    return this.integrations.disconnect(provider, workspaceId);
  }
}
