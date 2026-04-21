import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : ['info', 'warn', 'error'],
    })

    if (process.env.NODE_ENV === 'development') {
      this.setupQueryLogging()
    }
  }

  private setupQueryLogging() {
    const SLOW_QUERY_THRESHOLD_MS = 1000

    ;(this as any).$on('query', (e: Prisma.QueryEvent) => {
      if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`)
      }
    })
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Database connection established')
    } catch (error) {
      this.logger.error('Failed to connect to database', error)
      throw error
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Database connection closed')
  }

  async transactionWithTimeout<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    const timeout = options?.timeout || 30000
    const maxWait = options?.maxWait || 10000

    try {
      return await this.$transaction(fn, {
        timeout,
        maxWait,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Transaction failed with code ${error.code}: ${error.message}`)
      } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
        this.logger.error(`Unknown transaction error: ${error.message}`)
      } else {
        this.logger.error('Transaction failed', error)
      }
      throw error
    }
  }
}
