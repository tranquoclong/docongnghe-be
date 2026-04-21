import { Module } from '@nestjs/common'
import { ConversationController } from './conversation.controller'
import { ConversationService } from './conversation.service'
import { ConversationRepository } from './conversation.repo'
import { MessageService } from './message.service'
import { MessageRepository } from './message.repo'

@Module({
  controllers: [ConversationController],
  providers: [ConversationService, ConversationRepository, MessageService, MessageRepository],
  exports: [ConversationService, ConversationRepository, MessageService, MessageRepository],
})
export class ConversationModule {}
