import { Injectable } from '@nestjs/common'
import { RoleName } from 'src/shared/constants/role.constant'
import { RoleType } from 'src/shared/models/shared-role.model'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class RolesService {
  private clientRoleId: number | null = null
  constructor(private readonly prismaService: PrismaService) {}

  async getClientRoleId() {
    if (this.clientRoleId !== null) {
      return this.clientRoleId
    }
    const role: RoleType = await this.prismaService.$queryRaw`
      -- sql chúng ta sẽ limit là 1 vì chỉ lấy một cái giá trị mà thôi
      SELECT * FROM "Role" WHERE name = ${RoleName.Client} AND "deletedAt" IS NULL LIMIT 1;
    `.then((res: RoleType[]) => {
      if (res.length === 0) {
        throw new Error('Client role not found')
      }
      return res[0]
    })

    // Lấy phần từ tiên chính là lấy cái role là Client luôn
    // console.log('Check role', role)
    // const role = await this.prismaService.role.findUniqueOrThrow({
    //   where: {
    //     name: RoleName.Client,
    //   },
    // })

    this.clientRoleId = role.id
    return role.id
  }
}

// new RolesService(new PrismaService()).getClientRoleId()
