import { ForbiddenException, Injectable } from '@nestjs/common'
import { DashboardRepo } from './dashboard.repo'
import { GetDashboardQueryType } from './dashboard.model'
import { RoleName } from 'src/shared/constants/role.constant'

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepo: DashboardRepo) { }

  validatePrivilege({
    roleNameRequest,
  }: {
    roleNameRequest: string
  }) {
    console.log(roleNameRequest)
    if (roleNameRequest !== RoleName.Admin) {
      throw new ForbiddenException()
    }
    return true
  }

  async getDashboard(props: { query: GetDashboardQueryType; roleNameRequest: string }) {
    this.validatePrivilege({
      roleNameRequest: props.roleNameRequest,
    })

    const data = await this.dashboardRepo.list(props.query)
    return data
  }
}
