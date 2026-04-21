import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'
import envConfig from 'src/shared/config'
import { CHAT_REDIS } from '../websocket.constants'

const logger = new Logger('ChatRedisProvider')

/**
 * Factory provider that creates a single shared ioredis instance for the chat subsystem.
 *
 * - Retry strategy: min(times * 50, 2000) ms
 * - maxRetriesPerRequest: 3
 * - enableOfflineQueue: true
 * - Lifecycle: created once, quit on module destroy via ChatRedisShutdownService
 */
export const ChatRedisProvider = {
  provide: CHAT_REDIS,
  useFactory: (): Redis => {
    const redis = new Redis(envConfig.REDIS_URL, {
      connectTimeout: 15000,
      commandTimeout: 10000,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error(`Chat Redis: max retries (${times}) reached, stopping reconnection`)
          return null
        }
        const delay = Math.min(times * 200, 5000)
        logger.warn(`Chat Redis: retry attempt ${times}, next retry in ${delay}ms`)
        return delay
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      lazyConnect: false,
    })

    redis.on('connect', () => {
      logger.log('Chat Redis connected')
    })

    redis.on('ready', () => {
      logger.log('Chat Redis ready')
    })

    redis.on('error', (error) => {
      logger.error('Chat Redis error:', error)
    })

    redis.on('close', () => {
      logger.warn('Chat Redis connection closed')
    })

    redis.on('reconnecting', () => {
      logger.log('Chat Redis reconnecting...')
    })

    return redis
  },
}

/**
 * Service that handles graceful shutdown of the shared Chat Redis connection.
 * Factory providers cannot implement lifecycle hooks, so this companion service
 * injects the CHAT_REDIS instance and calls quit() on module destroy.
 */
@Injectable()
export class ChatRedisShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatRedisShutdownService.name)

  constructor(@Inject(CHAT_REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit()
      this.logger.log('Chat Redis disconnected gracefully')
    } catch (error) {
      this.logger.error('Error disconnecting Chat Redis:', error)
    }
  }
}
