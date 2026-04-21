import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { TypeOfVerificationCodeType } from '../../src/shared/constants/auth.constant'
import { TwoFactorService } from '../../src/shared/services/2fa.service'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { TokenService } from '../../src/shared/services/token.service'

/**
 * Create test user directly in database and return userId + accessToken
 */
export const createTestUser = async (
  email: string,
  password: string,
  roleId: number,
  prisma: PrismaClient,
  hashingService: HashingService,
  tokenService: TokenService,
): Promise<{ userId: number; accessToken: string }> => {
  // Hash password
  const hashedPassword = await hashingService.hash(password)

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name: email.split('@')[0],
      phoneNumber: `012345${Math.floor(Math.random() * 10000)}`,
      password: hashedPassword,
      roleId,
      status: 'ACTIVE',
    },
    include: {
      role: true,
    },
  })

  // Create device for this user
  const device = await prisma.device.create({
    data: {
      userId: user.id,
      userAgent: 'test-agent',
      ip: '127.0.0.1',
      isActive: true,
    },
  })

  // Generate access token
  const accessToken = await tokenService.signAccessToken({
    userId: user.id,
    roleId: user.roleId,
    deviceId: device.id,
    roleName: user.role.name,
  })

  return {
    userId: user.id,
    accessToken,
  }
}

/**
 * Reset database by truncating all tables and seeding basic data
 */
export const resetDatabase = async () => {
  if (!global.__GLOBAL_PRISMA__) return

  const prisma = global.__GLOBAL_PRISMA__

  // Get all table names and truncate with CASCADE to properly clean junction tables
  const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `

  // Truncate all tables with RESTART IDENTITY CASCADE
  await prisma.$transaction(
    tableNames.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.tablename}" RESTART IDENTITY CASCADE`)),
  )

  // Seed basic roles
  await prisma.role.createMany({
    data: [
      {
        id: 1,
        name: 'ADMIN',
        description: 'Administrator role',
        isActive: true,
      },
      {
        id: 2,
        name: 'CLIENT',
        description: 'Client role',
        isActive: true,
      },
      {
        id: 3,
        name: 'SELLER',
        description: 'Seller role',
        isActive: true,
      },
    ],
  })

  // Seed basic permissions for integration tests and assign to ADMIN role
  const permissionsData = [
    // Brand permissions
    { name: 'brands.create', path: '/brands', method: 'POST' as const, module: 'BRANDS' },
    { name: 'brands.update', path: '/brands/:brandId', method: 'PUT' as const, module: 'BRANDS' },
    { name: 'brands.delete', path: '/brands/:brandId', method: 'DELETE' as const, module: 'BRANDS' },
    // Category permissions
    { name: 'categories.create', path: '/categories', method: 'POST' as const, module: 'CATEGORIES' },
    { name: 'categories.update', path: '/categories/:categoryId', method: 'PUT' as const, module: 'CATEGORIES' },
    { name: 'categories.delete', path: '/categories/:categoryId', method: 'DELETE' as const, module: 'CATEGORIES' },
    // Role permissions
    { name: 'roles.read', path: '/roles', method: 'GET' as const, module: 'ROLES' },
    { name: 'roles.detail', path: '/roles/:roleId', method: 'GET' as const, module: 'ROLES' },
    { name: 'roles.create', path: '/roles', method: 'POST' as const, module: 'ROLES' },
    { name: 'roles.update', path: '/roles/:roleId', method: 'PUT' as const, module: 'ROLES' },
    { name: 'roles.delete', path: '/roles/:roleId', method: 'DELETE' as const, module: 'ROLES' },
    // Permission permissions
    { name: 'permissions.read', path: '/permissions', method: 'GET' as const, module: 'PERMISSIONS' },
    { name: 'permissions.detail', path: '/permissions/:permissionId', method: 'GET' as const, module: 'PERMISSIONS' },
    { name: 'permissions.create', path: '/permissions', method: 'POST' as const, module: 'PERMISSIONS' },
    { name: 'permissions.update', path: '/permissions/:permissionId', method: 'PUT' as const, module: 'PERMISSIONS' },
    {
      name: 'permissions.delete',
      path: '/permissions/:permissionId',
      method: 'DELETE' as const,
      module: 'PERMISSIONS',
    },
    // Auth permissions
    { name: 'auth.2fa.enable', path: '/auth/2fa/enable', method: 'POST' as const, module: 'AUTH' },
    { name: 'auth.2fa.disable', path: '/auth/2fa/disable', method: 'POST' as const, module: 'AUTH' },
    // Cart permissions
    { name: 'cart.read', path: '/cart', method: 'GET' as const, module: 'CART' },
    { name: 'cart.create', path: '/cart', method: 'POST' as const, module: 'CART' },
    { name: 'cart.update', path: '/cart/:cartItemId', method: 'PUT' as const, module: 'CART' },
    { name: 'cart.delete', path: '/cart/delete', method: 'POST' as const, module: 'CART' },
    // Order permissions
    { name: 'order.read', path: '/orders', method: 'GET' as const, module: 'ORDER' },
    { name: 'order.create', path: '/orders', method: 'POST' as const, module: 'ORDER' },
    { name: 'order.detail', path: '/orders/:orderId', method: 'GET' as const, module: 'ORDER' },
    { name: 'order.cancel', path: '/orders/:orderId', method: 'PUT' as const, module: 'ORDER' },
    // User permissions
    { name: 'users.read', path: '/users', method: 'GET' as const, module: 'USERS' },
    { name: 'users.detail', path: '/users/:userId', method: 'GET' as const, module: 'USERS' },
    { name: 'users.create', path: '/users', method: 'POST' as const, module: 'USERS' },
    { name: 'users.update', path: '/users/:userId', method: 'PUT' as const, module: 'USERS' },
    { name: 'users.delete', path: '/users/:userId', method: 'DELETE' as const, module: 'USERS' },
    // Profile permissions
    { name: 'profile.read', path: '/profile', method: 'GET' as const, module: 'PROFILE' },
    { name: 'profile.update', path: '/profile', method: 'PUT' as const, module: 'PROFILE' },
    { name: 'profile.changePassword', path: '/profile/change-password', method: 'PUT' as const, module: 'PROFILE' },
    // Manage Product permissions
    {
      name: 'manage-product.read',
      path: '/manage-product/products',
      method: 'GET' as const,
      module: 'MANAGE-PRODUCT',
    },
    {
      name: 'manage-product.detail',
      path: '/manage-product/products/:productId',
      method: 'GET' as const,
      module: 'MANAGE-PRODUCT',
    },
    {
      name: 'manage-product.create',
      path: '/manage-product/products',
      method: 'POST' as const,
      module: 'MANAGE-PRODUCT',
    },
    {
      name: 'manage-product.update',
      path: '/manage-product/products/:productId',
      method: 'PUT' as const,
      module: 'MANAGE-PRODUCT',
    },
    {
      name: 'manage-product.delete',
      path: '/manage-product/products/:productId',
      method: 'DELETE' as const,
      module: 'MANAGE-PRODUCT',
    },
    // Voucher permissions (User endpoints)
    { name: 'voucher.collect', path: '/vouchers/:id/collect', method: 'POST' as const, module: 'VOUCHER' },
    { name: 'voucher.my', path: '/vouchers/my', method: 'GET' as const, module: 'VOUCHER' },
    { name: 'voucher.apply', path: '/vouchers/apply', method: 'POST' as const, module: 'VOUCHER' },
    { name: 'voucher.myStats', path: '/vouchers/my/stats', method: 'GET' as const, module: 'VOUCHER' },
    // Voucher permissions (Admin/Seller management endpoints)
    { name: 'voucher.manage.create', path: '/vouchers/manage', method: 'POST' as const, module: 'VOUCHER-MANAGE' },
    { name: 'voucher.manage.read', path: '/vouchers/manage', method: 'GET' as const, module: 'VOUCHER-MANAGE' },
    { name: 'voucher.manage.stats', path: '/vouchers/manage/stats', method: 'GET' as const, module: 'VOUCHER-MANAGE' },
    { name: 'voucher.manage.update', path: '/vouchers/manage/:id', method: 'PUT' as const, module: 'VOUCHER-MANAGE' },
    {
      name: 'voucher.manage.delete',
      path: '/vouchers/manage/:id',
      method: 'DELETE' as const,
      module: 'VOUCHER-MANAGE',
    },
    // Review permissions
    { name: 'review.create', path: '/reviews', method: 'POST' as const, module: 'REVIEW' },
    { name: 'review.update', path: '/reviews/:reviewId', method: 'PUT' as const, module: 'REVIEW' },
    // Wishlist permissions
    { name: 'wishlist.items.read', path: '/wishlist/items', method: 'GET' as const, module: 'WISHLIST' },
    { name: 'wishlist.items.create', path: '/wishlist/items', method: 'POST' as const, module: 'WISHLIST' },
    { name: 'wishlist.items.update', path: '/wishlist/items/:itemId', method: 'PUT' as const, module: 'WISHLIST' },
    { name: 'wishlist.items.delete', path: '/wishlist/items/:itemId', method: 'DELETE' as const, module: 'WISHLIST' },
    {
      name: 'wishlist.items.moveToCart',
      path: '/wishlist/items/:itemId/move-to-cart',
      method: 'POST' as const,
      module: 'WISHLIST',
    },
    {
      name: 'wishlist.items.setTargetPrice',
      path: '/wishlist/items/:itemId/set-target-price',
      method: 'POST' as const,
      module: 'WISHLIST',
    },
    { name: 'wishlist.count', path: '/wishlist/count', method: 'GET' as const, module: 'WISHLIST' },
    { name: 'wishlist.check', path: '/wishlist/check', method: 'GET' as const, module: 'WISHLIST' },
    { name: 'wishlist.collections.read', path: '/wishlist/collections', method: 'GET' as const, module: 'WISHLIST' },
    { name: 'wishlist.collections.create', path: '/wishlist/collections', method: 'POST' as const, module: 'WISHLIST' },
    {
      name: 'wishlist.collections.update',
      path: '/wishlist/collections/:collectionId',
      method: 'PUT' as const,
      module: 'WISHLIST',
    },
    {
      name: 'wishlist.collections.delete',
      path: '/wishlist/collections/:collectionId',
      method: 'DELETE' as const,
      module: 'WISHLIST',
    },
    {
      name: 'wishlist.collections.addItem',
      path: '/wishlist/collections/:collectionId/items',
      method: 'POST' as const,
      module: 'WISHLIST',
    },
    // AI Assistant permissions
    {
      name: 'ai-assistant.conversations.create',
      path: '/ai-assistant/conversations',
      method: 'POST' as const,
      module: 'AI_ASSISTANT',
    },
    {
      name: 'ai-assistant.conversations.read',
      path: '/ai-assistant/conversations',
      method: 'GET' as const,
      module: 'AI_ASSISTANT',
    },
    {
      name: 'ai-assistant.conversations.detail',
      path: '/ai-assistant/conversations/:id',
      method: 'GET' as const,
      module: 'AI_ASSISTANT',
    },
    {
      name: 'ai-assistant.conversations.archive',
      path: '/ai-assistant/conversations/:id/archive',
      method: 'PATCH' as const,
      module: 'AI_ASSISTANT',
    },
    {
      name: 'ai-assistant.conversations.delete',
      path: '/ai-assistant/conversations/:id',
      method: 'DELETE' as const,
      module: 'AI_ASSISTANT',
    },
    {
      name: 'ai-assistant.messages.send',
      path: '/ai-assistant/conversations/:id/messages',
      method: 'POST' as const,
      module: 'AI_ASSISTANT',
    },
    { name: 'ai-assistant.search', path: '/ai-assistant/search', method: 'GET' as const, module: 'AI_ASSISTANT' },
    { name: 'ai-assistant.stats', path: '/ai-assistant/stats', method: 'GET' as const, module: 'AI_ASSISTANT' },
    // Conversation permissions
    { name: 'conversation.list', path: '/conversations', method: 'GET' as const, module: 'CONVERSATION' },
    {
      name: 'conversation.get',
      path: '/conversations/:conversationId',
      method: 'GET' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'conversation.create-direct',
      path: '/conversations/direct',
      method: 'POST' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'conversation.create-group',
      path: '/conversations/group',
      method: 'POST' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'conversation.update',
      path: '/conversations/:conversationId',
      method: 'PUT' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'conversation.archive',
      path: '/conversations/:conversationId/archive',
      method: 'POST' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'conversation.unarchive',
      path: '/conversations/:conversationId/unarchive',
      method: 'POST' as const,
      module: 'CONVERSATION',
    },
    { name: 'message.send', path: '/conversations/messages', method: 'POST' as const, module: 'CONVERSATION' },
    {
      name: 'message.edit',
      path: '/conversations/messages/:messageId',
      method: 'PUT' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'message.delete',
      path: '/conversations/messages/:messageId',
      method: 'DELETE' as const,
      module: 'CONVERSATION',
    },
    { name: 'message.read', path: '/conversations/messages/read', method: 'POST' as const, module: 'CONVERSATION' },
    {
      name: 'message.react',
      path: '/conversations/messages/:messageId/react',
      method: 'POST' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'message.unreact',
      path: '/conversations/messages/:messageId/react',
      method: 'DELETE' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'message.list',
      path: '/conversations/:conversationId/messages',
      method: 'GET' as const,
      module: 'CONVERSATION',
    },
    {
      name: 'message.search',
      path: '/conversations/messages/search',
      method: 'GET' as const,
      module: 'CONVERSATION',
    },
    // Language permissions
    { name: 'languages.list', path: '/languages', method: 'GET' as const, module: 'LANGUAGES' },
    { name: 'languages.detail', path: '/languages/:languageId', method: 'GET' as const, module: 'LANGUAGES' },
    { name: 'languages.create', path: '/languages', method: 'POST' as const, module: 'LANGUAGES' },
    { name: 'languages.update', path: '/languages/:languageId', method: 'PUT' as const, module: 'LANGUAGES' },
    { name: 'languages.delete', path: '/languages/:languageId', method: 'DELETE' as const, module: 'LANGUAGES' },
    // Media permissions
    { name: 'media.upload', path: '/media/images/upload', method: 'POST' as const, module: 'MEDIA' },
    // Address permissions
    { name: 'addresses.create', path: '/addresses', method: 'POST' as const, module: 'ADDRESS' },
    { name: 'addresses.read', path: '/addresses', method: 'GET' as const, module: 'ADDRESS' },
    { name: 'addresses.stats', path: '/addresses/stats', method: 'GET' as const, module: 'ADDRESS' },
    { name: 'addresses.default', path: '/addresses/default', method: 'GET' as const, module: 'ADDRESS' },
    { name: 'addresses.detail', path: '/addresses/:id', method: 'GET' as const, module: 'ADDRESS' },
    { name: 'addresses.update', path: '/addresses/:id', method: 'PUT' as const, module: 'ADDRESS' },
    { name: 'addresses.setDefault', path: '/addresses/:id/default', method: 'PUT' as const, module: 'ADDRESS' },
    { name: 'addresses.delete', path: '/addresses/:id', method: 'DELETE' as const, module: 'ADDRESS' },
  ]

  // Create permissions in bulk and collect IDs
  await prisma.permission.createMany({ data: permissionsData })
  const createdPermissions = await prisma.permission.findMany({ select: { id: true } })

  // Assign all permissions to ADMIN role
  await prisma.role.update({
    where: { id: 1 },
    data: {
      permissions: {
        connect: createdPermissions.map((p) => ({ id: p.id })),
      },
    },
  })

  // Assign cart, order, profile, voucher, review, wishlist, conversation, and AUTH permissions to CLIENT role (roleId: 2)
  const cartPermissions = createdPermissions.filter((p) => {
    const permData = permissionsData.find((pd) => pd.name === p.id.toString())
    return permData?.module === 'CART'
  })

  // Find cart, order, profile, voucher, review, wishlist, ai_assistant, conversation, and AUTH permissions by module
  const clientPermIds = await prisma.permission.findMany({
    where: {
      module: {
        in: [
          'CART',
          'ORDER',
          'PROFILE',
          'VOUCHER',
          'REVIEW',
          'WISHLIST',
          'AI_ASSISTANT',
          'CONVERSATION',
          'AUTH',
          'ADDRESS',
        ],
      },
    },
    select: { id: true },
  })

  await prisma.role.update({
    where: { id: 2 }, // CLIENT role
    data: {
      permissions: {
        connect: clientPermIds.map((p) => ({ id: p.id })),
      },
    },
  })

  // Assign manage-product, profile, and voucher-manage permissions to SELLER role (roleId: 3)
  const sellerPermIds = await prisma.permission.findMany({
    where: {
      module: {
        in: ['MANAGE-PRODUCT', 'PROFILE', 'VOUCHER-MANAGE'],
      },
    },
    select: { id: true },
  })

  await prisma.role.update({
    where: { id: 3 }, // SELLER role
    data: {
      permissions: {
        connect: sellerPermIds.map((p) => ({ id: p.id })),
      },
    },
  })
}

/**
 * Create test NestJS application
 */
export const createTestApp = async (): Promise<INestApplication> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(global.__GLOBAL_PRISMA__)
    .compile()

  const app = moduleFixture.createNestApplication()
  await app.init()

  return app
}

/**
 * Test data factories
 */
export const testDataFactory = {
  user: (overrides: Partial<any> = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'hashedPassword123',
    roleId: 2, // Client role
    status: 'ACTIVE' as const,
    avatar: null,
    totpSecret: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  role: (overrides: Partial<any> = {}) => ({
    id: 1,
    name: 'CLIENT',
    description: 'Client role',
    isActive: true,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permissions: [],
    ...overrides,
  }),

  permission: (overrides: Partial<any> = {}) => ({
    id: 1,
    name: 'users.read',
    description: 'Read users',
    path: '/users',
    method: 'GET' as const,
    module: 'USERS',
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  verificationCode: (overrides: Partial<any> = {}) => ({
    id: 1,
    email: 'test@example.com',
    code: '123456',
    type: 'REGISTER' as const,
    expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
    createdAt: new Date().toISOString(),
    ...overrides,
  }),

  tokens: (overrides: Partial<any> = {}) => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    ...overrides,
  }),
}

/**
 * Utility function to expect errors with proper typing
 */
export const expectError = async (fn: () => Promise<any>, expectedErrorClass: new (...args: any[]) => Error) => {
  await expect(fn()).rejects.toThrow(expectedErrorClass)
}

/**
 * Mock service factory
 */
export const createMockService = <T>(serviceMethods: (keyof T)[]): jest.Mocked<T> => {
  const mock = {} as jest.Mocked<T>

  serviceMethods.forEach((method) => {
    mock[method] = jest.fn() as any
  })

  return mock
}

// ==================== AUTH MODULE HELPERS ====================

/**
 * Helper: Tạo user và login để lấy accessToken + refreshToken
 * Sử dụng HTTP request thực tế qua /auth/login endpoint
 */
export const createAuthenticatedUser = async (
  app: INestApplication,
  email: string,
  password: string,
  roleId: number = 2, // Default: CLIENT role
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): Promise<{
  userId: number
  accessToken: string
  refreshToken: string
  deviceId: number
}> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  const hashingService = app.get(HashingService)

  // 1. Tạo user trong database
  const hashedPassword = await hashingService.hash(password)
  const user = await prisma.user.create({
    data: {
      email,
      name: email.split('@')[0],
      phoneNumber: `012345${Math.floor(Math.random() * 10000)}`,
      password: hashedPassword,
      roleId,
      status,
    },
  })

  // 2. Login qua HTTP để lấy tokens (giống real flow)
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .set('User-Agent', 'test-agent')
    .set('X-Forwarded-For', '127.0.0.1')

  // 3. Lấy device vừa tạo
  const device = await prisma.device.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return {
    userId: user.id,
    accessToken: loginResponse.body.accessToken,
    refreshToken: loginResponse.body.refreshToken,
    deviceId: device!.id,
  }
}

/**
 * Helper: Enable 2FA cho user và trả về secret + TOTP code
 */
export const enable2FA = async (
  app: INestApplication,
  accessToken: string,
): Promise<{
  secret: string
  uri: string
  totpCode: string
}> => {
  const twoFactorService = app.get(TwoFactorService)

  // 1. Call API enable 2FA (không expect 201 để debug)
  const response = await request(app.getHttpServer())
    .post('/auth/2fa/enable')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({})

  // Debug: Log response nếu không phải 201
  if (response.status !== 201) {
    console.error('Enable 2FA failed:', response.status, response.body)
    throw new Error(`Enable 2FA failed with status ${response.status}`)
  }

  const { secret, uri } = response.body

  // 2. Generate TOTP code từ secret (để dùng cho tests)
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  const user = await prisma.user.findFirst({
    where: { totpSecret: secret },
  })

  const totpCode = generateTOTPCode(user!.email, secret, twoFactorService)

  return { secret, uri, totpCode }
}

/**
 * Helper: Generate TOTP code từ secret
 */
export const generateTOTPCode = (email: string, secret: string, twoFactorService: TwoFactorService): string => {
  // Sử dụng OTPAuth để generate code
  const OTPAuth = require('otpauth')
  const totp = new OTPAuth.TOTP({
    issuer: 'docongnghe',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })

  return totp.generate()
}

/**
 * Helper: Send OTP và trả về OTP code từ database
 */
export const sendOTPAndGetCode = async (
  app: INestApplication,
  email: string,
  type: TypeOfVerificationCodeType,
): Promise<string> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient

  // 1. Send OTP request
  await request(app.getHttpServer()).post('/auth/otp').send({ email, type }).expect(201)

  // 2. Lấy OTP code từ database (vì EmailService bị mock)
  const verificationCode = await prisma.verificationCode.findUnique({
    where: {
      email_type: { email, type },
    },
  })

  return verificationCode!.code
}

/**
 * Helper: Tạo expired OTP trong database
 */
export const createExpiredOTP = async (email: string, type: TypeOfVerificationCodeType): Promise<string> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient

  const code = '123456'
  await prisma.verificationCode.upsert({
    where: {
      email_type: { email, type },
    },
    create: {
      email,
      code,
      type,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    },
    update: {
      code,
      expiresAt: new Date(Date.now() - 1000),
    },
  })

  return code
}

/**
 * Helper: Tạo user với 2FA đã enabled
 */
export const createUserWith2FA = async (
  app: INestApplication,
  email: string,
  password: string,
  roleId: number = 2,
): Promise<{
  userId: number
  accessToken: string
  refreshToken: string
  secret: string
  totpCode: string
}> => {
  // 1. Tạo user và login
  const { userId, accessToken, refreshToken } = await createAuthenticatedUser(app, email, password, roleId)

  // 2. Enable 2FA
  const { secret, totpCode } = await enable2FA(app, accessToken)

  return { userId, accessToken, refreshToken, secret, totpCode }
}

/**
 * Helper: Verify user trong database có totpSecret hay không
 */
export const verifyUserHas2FA = async (userId: number): Promise<boolean> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  })

  return user?.totpSecret !== null
}

/**
 * Helper: Verify refresh token tồn tại trong database
 */
export const verifyRefreshTokenExists = async (token: string): Promise<boolean> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
  })

  return refreshToken !== null
}

/**
 * Helper: Verify device isActive status
 */
export const verifyDeviceIsActive = async (deviceId: number): Promise<boolean> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { isActive: true },
  })

  return device?.isActive === true
}

/**
 * Helper: Verify verification code đã bị xóa
 */
export const verifyOTPDeleted = async (email: string, type: TypeOfVerificationCodeType): Promise<boolean> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  const verificationCode = await prisma.verificationCode.findUnique({
    where: {
      email_type: { email, type },
    },
  })

  return verificationCode === null
}

/**
 * Helper: Count số devices của user
 */
export const countUserDevices = async (userId: number): Promise<number> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  return await prisma.device.count({
    where: { userId },
  })
}

/**
 * Helper: Count số refresh tokens của user
 */
export const countUserRefreshTokens = async (userId: number): Promise<number> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  return await prisma.refreshToken.count({
    where: { userId },
  })
}

/**
 * Helper: Tạo user trực tiếp trong database (không qua API)
 * Dùng cho test cases cần setup nhanh
 */
export const createUserDirectly = async (
  email: string,
  password: string,
  roleId: number = 2,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
  totpSecret?: string,
): Promise<number> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient

  // Hash password bằng bcrypt với 10 salt rounds (giống HashingService)
  const bcrypt = require('bcryptjs')
  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name: email.split('@')[0],
      phoneNumber: `012345${Math.floor(Math.random() * 10000)}`,
      password: hashedPassword,
      roleId,
      status,
      totpSecret,
    },
  })

  return user.id
}

/**
 * Helper: Verify user password đã được update
 */
export const verifyPasswordChanged = async (
  app: INestApplication,
  email: string,
  newPassword: string,
): Promise<boolean> => {
  const prisma = global.__GLOBAL_PRISMA__ as PrismaClient
  const hashingService = app.get(HashingService)

  const user = await prisma.user.findFirst({
    where: { email },
    select: { password: true },
  })

  if (!user) return false

  return await hashingService.compare(newPassword, user.password)
}

/**
 * Helper: Mock Google OAuth user data
 */
export const mockGoogleUserData = {
  email: 'testgoogle@gmail.com',
  name: 'Test Google User',
  picture: 'https://lh3.googleusercontent.com/a/default-user',
}

/**
 * Helper: Generate mock Google OAuth state
 */
export const generateMockGoogleState = (userAgent: string = 'test-agent', ip: string = '127.0.0.1'): string => {
  return Buffer.from(JSON.stringify({ userAgent, ip })).toString('base64')
}
