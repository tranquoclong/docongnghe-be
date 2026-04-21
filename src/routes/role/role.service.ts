import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common'
import { RoleRepo } from 'src/routes/role/role.repo'
import { CreateRoleBodyType, GetRolesQueryType, UpdateRoleBodyType } from 'src/routes/role/role.model'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { ProhibitedActionOnBaseRoleException, RoleAlreadyExistsException } from 'src/routes/role/role.error'
import { RoleName } from 'src/shared/constants/role.constant'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { MESSAGES } from 'src/shared/constants/app.constant'

@Injectable()
export class RoleService {
  constructor(
    private roleRepo: RoleRepo,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async verifyRole(roleId: number) {
    const role = await this.roleRepo.findById(roleId)
    if (!role) {
      throw NotFoundRecordException
    }
    // Không cho phép bất kì ai cập nhật role ADMIN kể cả là ADMIN
    // Không cho phép bất kì ai xóa 3 role cơ bản
    const baseRoles: string[] = [RoleName.Admin, RoleName.Client, RoleName.Seller]

    if (baseRoles.includes(role.name)) {
      throw ProhibitedActionOnBaseRoleException
    }
  }

  async list(pagination: GetRolesQueryType) {
    const data = await this.roleRepo.list(pagination)
    return data
  }

  async findById(id: number) {
    const role = await this.roleRepo.findById(id)
    if (!role) {
      throw NotFoundRecordException
    }
    return role
  }

  async create({ data, createdById }: { data: CreateRoleBodyType; createdById: number }) {
    try {
      const role = await this.roleRepo.create({
        createdById,
        data,
      })
      return role
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw RoleAlreadyExistsException
      }
      throw error
    }
  }

  async update({ id, data, updatedById }: { id: number; data: UpdateRoleBodyType; updatedById: number }) {
    try {
      await this.verifyRole(id)

      const updatedRole = await this.roleRepo.update({
        id,
        updatedById,
        data,
      })
      await this.cacheManager.del(`roles:${updatedRole.id}`) // Xoá cache của role đã được cập nhật
      return updatedRole
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundRecordException
      }
      if (isUniqueConstraintPrismaError(error)) {
        throw RoleAlreadyExistsException
      }
      // Khi mà bên repo quăng ra lỗi khi mà update những cái permission đã bị xóa rồi thì bên đây sẽ hứng cái lỗi đó và thông báo cho user biết

      if (error instanceof HttpException) {
        throw error
      }

      // Do là cái exception nó cũng là một instanceof  Error nên là nó nhảy vào cái request này
      if (error instanceof Error) {
        throw new BadRequestException(error.message)
      }

      throw error
    }
  }

  async delete({ id, deletedById }: { id: number; deletedById: number }) {
    try {
      await this.verifyRole(id)

      await this.roleRepo.delete({
        id,
        deletedById,
      })
      await this.cacheManager.del(`roles:${id}`) // Xoá cache của role đã xoá
      return {
        message: MESSAGES.DELETE_SUCCESS,
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundRecordException
      }
      throw error
    }
  }
}
