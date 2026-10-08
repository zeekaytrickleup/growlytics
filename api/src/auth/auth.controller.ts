import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Workspace } from './workspace.decorator';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Workspace() workspaceId: string) {
    return this.auth.me(workspaceId);
  }

  @Post('workspaces')
  createWorkspace(@Body() body: { name?: string }) {
    return this.auth.createWorkspace(body?.name ?? '');
  }

  @Delete('workspaces/:id')
  deleteWorkspace(@Param('id') id: string) {
    return this.auth.deleteWorkspace(id);
  }
}
