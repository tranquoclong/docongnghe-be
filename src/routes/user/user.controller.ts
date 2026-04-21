import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodResponse } from 'nestjs-zod'
import {
  CreateUserBodyDTO,
  CreateUserResDTO,
  GetUserParamsDTO,
  GetUsersQueryDTO,
  GetUsersResDTO,
  UpdateUserBodyDTO,
} from 'src/routes/user/user.dto'
import { UserService } from 'src/routes/user/user.service'
import { ActiveRolePermissions } from 'src/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { MessageResDTO } from 'src/shared/dtos/response.dto'
import { GetUserProfileResDTO, UpdateProfileResDTO } from 'src/shared/dtos/shared-user.dto'
import { ApiBearerAuth } from '@nestjs/swagger'

@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ZodResponse({ type: GetUsersResDTO })
  getListUser(@Query() query: GetUsersQueryDTO) {
    return this.userService.getListUser({
      page: query.page,
      limit: query.limit,
    })
  }

  @Get(':userId')
  @ZodResponse({ type: GetUserProfileResDTO })
  findById(@Param() params: GetUserParamsDTO) {
    return this.userService.findById(params.userId)
  }

  @Post()
  @ZodResponse({ type: CreateUserResDTO })
  createUser(
    @Body() body: CreateUserBodyDTO,
    @ActiveUser('userId') userId: number,
    @ActiveRolePermissions('name') roleName: string,
  ) {
    return this.userService.createUser({
      data: body,
      createdById: userId,
      createdByRoleName: roleName,
    })
  }

  @Put(':userId')
  @ZodResponse({ type: UpdateProfileResDTO as any })
  updateUser(
    @Body() body: UpdateUserBodyDTO,
    @Param() params: GetUserParamsDTO,
    @ActiveUser('userId') userId: number,
    @ActiveRolePermissions('name') roleName: string,
  ) {
    return this.userService.updateUser({
      data: body,
      id: params.userId,
      updatedById: userId,
      updatedByRoleName: roleName,
    })
  }

  @Delete(':userId')
  @ZodResponse({ type: MessageResDTO })
  deleteUser(
    @Param() params: GetUserParamsDTO,
    @ActiveUser('userId') userId: number,
    @ActiveRolePermissions('name') roleName: string,
  ) {
    return this.userService.deletedUser({
      id: params.userId,
      deletedById: userId,
      deletedByRoleName: roleName,
    })
  }
}
