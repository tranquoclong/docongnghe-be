import { Module } from '@nestjs/common'

// Import chat services and handlers
import { ChatRedisService } from './services/chat-redis.service'
import { ChatConnectionHandler } from './handlers/chat-connection.handler'
import { ChatMessageHandler } from './handlers/chat-message.handler'
import { ChatTypingHandler } from './handlers/chat-typing.handler'
import { ChatInteractionHandler } from './handlers/chat-interaction.handler'
import { ChatRedisProvider, ChatRedisShutdownService } from './providers/chat-redis.provider'
import { CHAT_REDIS } from './websocket.constants'

// Import conversation module for services
import { ConversationModule } from 'src/routes/conversation/conversation.module'

@Module({
  imports: [ConversationModule],
  providers: [
    // Shared Redis instance
    ChatRedisProvider,
    // Graceful shutdown handler for Chat Redis
    ChatRedisShutdownService,
    // Chat services
    ChatRedisService,
    ChatConnectionHandler,
    ChatMessageHandler,
    ChatTypingHandler,
    ChatInteractionHandler,
  ],
  exports: [
    CHAT_REDIS,
    ChatRedisService,
    ChatConnectionHandler,
    ChatMessageHandler,
    ChatTypingHandler,
    ChatInteractionHandler,
    // Re-export ConversationModule so EnhancedChatGateway can inject ConversationRepository
    ConversationModule,
  ],
})
export class ChatModule {}
