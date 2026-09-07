import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { Workspace } from '../auth/workspace.decorator';

class AskDto {
  question!: string;
}

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('suggestions')
  suggestions() {
    return this.assistant.suggestions();
  }

  @Post('ask')
  ask(@Body() body: AskDto, @Workspace() workspaceId: string) {
    const question = (body?.question ?? '').toString().trim();
    if (!question) {
      return { error: 'question is required' };
    }
    return this.assistant.ask(question, workspaceId);
  }
}
