import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { DashboardRepo } from './dashboard.repo'

@Module({
  providers: [DashboardService, DashboardRepo],
  controllers: [DashboardController],
})
export class DashboardModule { }
