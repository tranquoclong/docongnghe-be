import { INestApplicationContext, Logger } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { Server, ServerOptions, Socket } from 'socket.io'
import { generateRoomUserId } from 'src/shared/helpers'
import { SharedWebsocketRepository } from 'src/shared/repositories/shared-websocket.repo'
import { TokenService } from 'src/shared/services/token.service'
import { CHAT_REDIS } from './websocket.constants'

/**
 * Get CORS allowed origins from environment or use defaults
 * In production, this should be configured via ALLOWED_ORIGINS env variable
 */
function getCorsOrigins(): string[] | boolean {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
  if (allowedOrigins) {
    // Parse comma-separated origins from env
    return allowedOrigins.split(',').map((origin) => origin.trim())
  }
  // Default: allow localhost for development
  if (process.env.NODE_ENV === 'production') {
    // In production without explicit config, deny all (safer default)
    return false
  }
  // Development defaults
  return ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
}

export class WebsocketAdapter extends IoAdapter {
  private readonly logger = new Logger(WebsocketAdapter.name)
  private readonly sharedWebsocketRepository: SharedWebsocketRepository
  private readonly tokenService: TokenService
  private readonly app: INestApplicationContext
  private adapterConstructor: ReturnType<typeof createAdapter>

  constructor(app: INestApplicationContext) {
    super(app)
    this.app = app
    this.sharedWebsocketRepository = app.get(SharedWebsocketRepository)
    this.tokenService = app.get(TokenService)
  }

  async connectToRedis(): Promise<void> {
    const pubClient: Redis = this.app.get(CHAT_REDIS)
    const subClient = pubClient.duplicate()

    const REDIS_CONNECT_TIMEOUT = 30000 // 30 seconds max wait

    // Wait for client to be ready with timeout to prevent infinite hanging
    const waitForReady = (client: Redis, name: string): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        if (client.status === 'ready') {
          resolve()
          return
        }

        const timer = setTimeout(() => {
          client.removeAllListeners('ready')
          reject(new Error(`${name} Redis connection timeout after ${REDIS_CONNECT_TIMEOUT / 1000}s`))
        }, REDIS_CONNECT_TIMEOUT)

        client.once('ready', () => {
          clearTimeout(timer)
          resolve()
        })

        client.once('error', (err) => {
          clearTimeout(timer)
          reject(new Error(`${name} Redis connection error: ${err.message}`))
        })
      })
    }

    try {
      await Promise.all([waitForReady(pubClient, 'PubClient'), waitForReady(subClient, 'SubClient')])
      this.adapterConstructor = createAdapter(pubClient, subClient)
      this.logger.log('Redis pub/sub adapter connected successfully')
    } catch (error) {
      this.logger.error(`Failed to connect Redis adapter: ${error.message}`)
      throw error
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const corsOrigins = getCorsOrigins()
    this.logger.log(`WebSocket CORS origins: ${JSON.stringify(corsOrigins)}`)

    const server: Server = super.createIOServer(port, {
      ...options,
      pingInterval: 25000,
      pingTimeout: 10000,
      cors: {
        origin: corsOrigins,
        credentials: true,
      },
    })

    // Apply auth middleware to default namespace
    server.use((socket, next) => {
      this.authMiddleware(socket, next)
        .then(() => {})
        .catch(() => {})
    })

    // Apply auth middleware to all namespaces
    server.of(/.*/).use((socket, next) => {
      this.authMiddleware(socket, next)
        .then(() => {})
        .catch(() => {})
    })

    return server
  }

  /**
   * Authentication middleware - verifies JWT and attaches user info to socket
   * This is the SINGLE source of truth for WebSocket authentication
   */
  async authMiddleware(socket: Socket, next: (err?: any) => void) {
    // Extract token from headers or auth object
    const authorization = socket.handshake.auth?.authorization || socket.handshake.headers?.authorization
    if (!authorization) {
      return next(new Error('Missing Authorization header'))
    }

    const accessToken = typeof authorization === 'string' ? authorization.split(' ')[1] : null
    if (!accessToken) {
      return next(new Error('Missing access token'))
    }

    try {
      const { userId } = await this.tokenService.verifyAccessToken(accessToken)

      // Attach userId to socket.data for use by handlers (SINGLE SOURCE OF TRUTH)
      socket.data.userId = userId

      // Join user's personal room for notifications (unified room naming)
      await socket.join(generateRoomUserId(userId))

      this.logger.debug(`Socket ${socket.id} authenticated for user ${userId}`)
      next()
    } catch (error) {
      this.logger.warn(`Socket authentication failed: ${error.message}`)
      next(new Error('Authentication failed'))
    }
  }
}
