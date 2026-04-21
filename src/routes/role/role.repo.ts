import { Injectable } from '@nestjs/common'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import {
  CreateRoleBodyType,
  GetRolesQueryType,
  GetRolesResType,
  RoleType,
  RoleWithPermissionsType,
  UpdateRoleBodyType,
} from 'src/routes/role/role.model'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RolePermissionsType } from 'src/shared/models/shared-role.model'

@Injectable()
@SerializeAll()
export class RoleRepo {
  constructor(private prismaService: PrismaService) {}

  async list(pagination: GetRolesQueryType): Promise<GetRolesResType> {
    const skip = (pagination.page - 1) * pagination.limit
    const take = pagination.limit
    const [totalItems, data] = await Promise.all([
      this.prismaService.role.count({
        where: {
          deletedAt: null,
        },
      }),
      this.prismaService.role.findMany({
        where: {
          deletedAt: null,
        },
        skip,
        take,
      }),
    ])
    return {
      data,
      totalItems,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(totalItems / pagination.limit),
    } as any
  }

  findById(id: number): Promise<RoleWithPermissionsType | null> {
    return this.prismaService.role.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      // Nên thêm include để mà nó trả về mảng các permissions của role
      include: {
        permissions: {
          where: {
            deletedAt: null,
          },
        },
      },
    }) as any
  }

  create({ createdById, data }: { createdById: number | null; data: CreateRoleBodyType }): Promise<RoleType> {
    return this.prismaService.role.create({
      data: {
        ...data,
        createdById,
      },
    }) as any
  }

  async update({
    id,
    updatedById,
    data,
  }: {
    id: number
    updatedById: number
    data: UpdateRoleBodyType
  }): Promise<RolePermissionsType> {
    // Kiểm tra nếu có bất cứ permissionId nào mà đã soft-delete thì không cho phép cập nhật, còn nếu mà nó đã bị deleted thì chỗ cập nhật ở dưới nó sẽ quăng ra lỗi
    if (data.permissionIds.length > 0) {
      // chúng ta sẽ fetch ra hết các permission dựa vào permissionIds này
      //  Trả về mảng các permission theo cái mảng permissionIds đã được cung cấp
      const permission = await this.prismaService.permission.findMany({
        where: {
          id: {
            in: data.permissionIds,
          },
        },
      })
      // Filter các permisison đã bị xóa mềm ở trong database
      const deletedPermission = permission.filter((item) => item.deletedAt)
      if (deletedPermission.length > 0) {
        const deletedIds = deletedPermission.map((item) => item.id).join(', ')
        throw new Error(`Cannot update role with deleted permissions: ${deletedIds}`)
      }
    }

    // Chỗ này sử dụng await hay không thì cũng ko thành vấn đề gì
    return this.prismaService.role.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        permissions: {
          // Tại vì thằng nó cần là một kiểu {id:number}[] như này là nó phù hợp
          // {id: <permissionId>} đây là cú pháp mà Prisma yêu cầu để xác định các bản ghi cần liên kết.
          // Khi mà set như thế này thì các mảng permission mới sẽ được thêm vào, lúc này danh sách permissions sẽ được cập nhật lại các permission mới
          // Cũng tương tự khi mà chúng ta đưa mấy cái thằng permissionId đã được xóa cứng vào trong đây thì prisma nó cũng quăng cái lỗi mà thôi
          set: data.permissionIds.map((id) => ({ id })),
        },
        updatedById,
      },
      include: {
        // Chỉ trả về các permissions chưa bị xóa mềm
        permissions: {
          where: {
            deletedAt: null,
          },
        },
      },
    }) as any
  }

  delete(
    {
      id,
      deletedById,
    }: {
      id: number
      deletedById: number
    },
    isHard?: boolean,
  ): Promise<RoleType> {
    return (
      isHard
        ? this.prismaService.role.delete({
            where: {
              id,
            },
          })
        : this.prismaService.role.update({
            where: {
              id,
              deletedAt: null,
            },
            data: {
              deletedAt: new Date(),
              deletedById,
            },
          })
    ) as any
  }
}
