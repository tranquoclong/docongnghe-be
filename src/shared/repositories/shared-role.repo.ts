import { Injectable } from '@nestjs/common'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { RoleName } from 'src/shared/constants/role.constant'
import { RoleType } from 'src/shared/models/shared-role.model'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class SharedRoleRepository {
  private clientRoleId: number | null = null
  private adminRoleId: number | null = null

  constructor(private readonly prismaService: PrismaService) {}

  private async getRole(roleName: string): Promise<RoleType> {
    const role: RoleType = await this.prismaService.$queryRaw`
    -- sql chúng ta sẽ limit là 1 vì chỉ lấy một cái giá trị mà thôi
    SELECT * FROM "Role" WHERE name = ${roleName} AND "deletedAt" IS NULL LIMIT 1;
  `.then((res: RoleType[]) => {
      if (res.length === 0) {
        throw new Error('Role not found')
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
    return role
  }

  async getClientRoleId() {
    if (this.clientRoleId) {
      return this.clientRoleId
    }
    const role = await this.getRole(RoleName.Client)

    this.clientRoleId = role.id
    return role.id
  }

  async getAdminRoleId() {
    if (this.adminRoleId) {
      return this.adminRoleId
    }
    const role = await this.getRole(RoleName.Admin)

    this.adminRoleId = role.id
    return role.id
  }
}

// new RolesService(new PrismaService()).getClientRoleId()
