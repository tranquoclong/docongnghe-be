import { Module } from '@nestjs/common'
import { AIAssistantController } from './ai-assistant.controller'
import { AIAssistantService } from './ai-assistant.service'
import { AIAssistantRepo } from './ai-assistant.repo'
import { SharedModule } from 'src/shared/shared.module'

@Module({
  controllers: [AIAssistantController],
  providers: [AIAssistantService, AIAssistantRepo],
  exports: [AIAssistantService, AIAssistantRepo],
})
export class AIAssistantModule {}
