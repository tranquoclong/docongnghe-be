import { PrismaClient } from '@prisma/client'
import { server } from './msw/server'

// Global test database setup
declare global {
  var __GLOBAL_PRISMA__: PrismaClient | undefined
}

// MSW lifecycle — intercept external HTTP requests
beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'bypass' })
  // Initialize global Prisma client using existing DATABASE_URL
  global.__GLOBAL_PRISMA__ = new PrismaClient()
  await global.__GLOBAL_PRISMA__.$connect()
})

afterEach(() => {
  server.resetHandlers()
})

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  server.close()
  if (global.__GLOBAL_PRISMA__) {
    await global.__GLOBAL_PRISMA__.$disconnect()
  }
})

/**
 * Clean up data between tests (keep schema)
 */
export const cleanupDatabase = async () => {
  if (!global.__GLOBAL_PRISMA__) return

  const prisma = global.__GLOBAL_PRISMA__

  // Get all table names
  const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `

  // Disable foreign key checks and truncate all tables
  await prisma.$transaction(
    tableNames.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.tablename}" RESTART IDENTITY CASCADE`)),
  )
}

/**
 * Seed basic data for testing
 */
export const seedTestData = async () => {
  if (!global.__GLOBAL_PRISMA__) return

  const prisma = global.__GLOBAL_PRISMA__

  // Create basic roles
  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'Administrator role',
    },
  })

  const clientRole = await prisma.role.create({
    data: {
      name: 'CLIENT',
      description: 'Client role',
    },
  })

  // Create basic permissions
  const permissions = await prisma.permission.createMany({
    data: [
      {
        name: 'users.read',
        description: 'Read users',
        path: '/users',
        method: 'GET',
        module: 'USERS',
      },
      {
        name: 'users.create',
        description: 'Create users',
        path: '/users',
        method: 'POST',
        module: 'USERS',
      },
    ],
  })

  return { adminRole, clientRole, permissions }
}
