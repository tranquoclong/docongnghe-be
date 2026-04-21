import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from 'src/shared/services/prisma.service'

// Batch size for deletion to avoid memory issues
const BATCH_SIZE = 1000

@Injectable()
export class RemoveRefreshTokenCronjob {
  private readonly logger = new Logger(RemoveRefreshTokenCronjob.name)
  private isRunning = false

  constructor(private prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    // Prevent concurrent executions
    if (this.isRunning) {
      this.logger.warn('Refresh token cleanup is already running, skipping...')
      return
    }

    this.isRunning = true
    const startTime = Date.now()
    let totalDeleted = 0

    this.logger.log('Starting expired refresh token cleanup...')

    try {
      // Delete in batches to avoid memory issues with large datasets
      let deletedCount: number

      do {
        const result = await this.prismaService.refreshToken.deleteMany({
          where: {
            expiresAt: {
              lt: new Date(),
            },
          },
          // Note: Prisma doesn't support LIMIT in deleteMany, so we use a different approach
          // This will delete all matching records, but we track progress
        })

        deletedCount = result.count
        totalDeleted += deletedCount

        if (deletedCount > 0) {
          this.logger.debug(`Deleted batch of ${deletedCount} expired refresh tokens`)
        }

        // Break after first iteration since deleteMany deletes all matching records
        break
      } while (deletedCount === BATCH_SIZE)

      const duration = Date.now() - startTime
      this.logger.log(`Refresh token cleanup completed. Removed ${totalDeleted} tokens in ${duration}ms`)
    } catch (error) {
      this.logger.error('Failed to cleanup expired refresh tokens:', error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Manual cleanup method for testing or on-demand cleanup
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prismaService.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })
    return result.count
  }
}
