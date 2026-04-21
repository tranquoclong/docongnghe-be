import { CACHE_MANAGER } from '@nestjs/cache-manager'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Cache } from 'cache-manager'
import { keyBy } from 'lodash'
import { RoleWithPermissionsType } from 'src/routes/role/role.model'
import { REQUEST_ROLE_PERMISSIONS, REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { HTTPMethod } from 'src/shared/constants/role.constant'
import { RolePermissionsType } from 'src/shared/models/shared-role.model'
import { PrismaService } from 'src/shared/services/prisma.service'
import { TokenService } from 'src/shared/services/token.service'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'

type Permission = RolePermissionsType['permissions'][number]
type CachedRole = RolePermissionsType & {
  permissions: {
    [key: string]: Permission
  }
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    // Extract and validate access token from request header
    const decodedAccessToken = await this.extractAndValidateToken(request)

    // Check user permissions based on the access token payload
    await this.validateUserPermission(decodedAccessToken, request)

    return true
  }

  private async extractAndValidateToken(request: any): Promise<AccessTokenPayload> {
    const accessToken = this.extractAccessTokenFromHeader(request)
    try {
      const decodedAccessToken = await this.tokenService.verifyAccessToken(accessToken)

      request[REQUEST_USER_KEY] = decodedAccessToken
      return decodedAccessToken
    } catch (error) {
      throw new UnauthorizedException('Error.InvalidAccessToken')
    }
  }

  private extractAccessTokenFromHeader(request: any): string {
    const accessToken = request.headers.authorization?.split(' ')[1]
    if (!accessToken) {
      throw new UnauthorizedException('Error.MissingAccessToken')
    }
    return accessToken
  }

  // func Validate user permission
  private async validateUserPermission(decodedAccessToken: AccessTokenPayload, request: any): Promise<void> {
    const roleId: number = decodedAccessToken.roleId
    const path: string = request.route.path
    const method = request.method as keyof typeof HTTPMethod
    const cacheKey = `role:${roleId}`

    // DEBUG: Log path and method for conversation routes
    if (path?.includes('conversation')) {
      console.log('[AccessTokenGuard] DEBUG - Path:', path, 'Method:', method)
    }
    // 1. Thử lấy từ cache
    let cachedRole = await this.cacheManager.get<CachedRole>(cacheKey)
    // 2. Nếu không có trong cache, thì truy vấn từ cơ sở dữ liệu
    if (cachedRole == null) {
      const role = (await this.prismaService.role
        .findUniqueOrThrow({
          where: {
            id: roleId,
            deletedAt: null,
            isActive: true, // Role bị vô hiệu hóa thì sẽ từ chối request
          },
          include: {
            // Nếu mà lấy ra như này thì nó sẽ lấy ra hết cái permission nên là chúng ta thêm path và method vào để mà nó chỉ lấy ra được một cái permission duy nhất mà thôi
            permissions: {
              where: {
                deletedAt: null,
                // path,
                // method,
              },
            },
          },
        })
        .catch(() => {
          // hay vì prisma tự động quăng ra lỗi thông thường thì chúng ta sẽ chủ động quăng ra lỗi
          throw new ForbiddenException()
        })) as unknown as RoleWithPermissionsType
      const permissionObject = keyBy(
        role.permissions,
        (permission) => `${permission.path}:${permission.method}`,
      ) as CachedRole['permissions']
      cachedRole = { ...role, permissions: permissionObject }
      await this.cacheManager.set(cacheKey, cachedRole, 1000 * 60 * 60) // Cache for 1 hour

      // request[REQUEST_ROLE_PERMISSIONS] = role // Thêm role vào cho người dùng(có kèm theo cả permissions cho người dùng nữa)
      request[REQUEST_ROLE_PERMISSIONS] = role
    }

    // console.log('role permission', cachedRole?.permissions)
    // const canAccess = role.permissions.some((permission) => permission.method === method && permission.path === path)
    // Ở đây chúng ta có thể check theo độ dài của cái permissions mà không cần phải query thêm vào làm gì
    // const canAccess = role.permissions.length > 0 // Chỉ cần như này là được
    // 3. Kiểm tra quyền truy cập
    const canAccess: Permission | undefined = cachedRole?.permissions[`${path}:${method}`]
    if (!canAccess) {
      throw new ForbiddenException('Error.PermissionDenied')
    }
  }
}
