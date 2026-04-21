import { Controller, Get, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { GetDashboardQueryDTO, GetDashboardResDTO } from 'src/routes/dashboard/dashboard.dto'
import { ZodResponse } from 'nestjs-zod'
import { ApiBearerAuth } from '@nestjs/swagger'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'

@Controller('dashboard')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get()
  @ZodResponse({ type: GetDashboardResDTO })
  getDashboard(@Query() query: GetDashboardQueryDTO, @ActiveUser() user: AccessTokenPayload) {
    return this.dashboardService.getDashboard({
      query,
      roleNameRequest: user.roleName,
    })
  }
}
