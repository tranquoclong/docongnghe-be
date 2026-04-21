import { server } from './msw/server'

// MSW lifecycle — intercept external HTTP requests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock helpers functions - keep real implementations, only mock specific functions
jest.mock('src/shared/helpers', () => {
  const actual = jest.requireActual('src/shared/helpers')
  return {
    ...actual,
    generateOTP: jest.fn().mockReturnValue('123456'),
    isUniqueConstraintPrismaError: jest.fn(),
    isNotFoundPrismaError: jest.fn(),
    isForeignKeyConstraintPrismaError: jest.fn(),
  }
})

// Tăng memory limit cho test environment
process.env.NODE_OPTIONS = '--max-old-space-size=4096'

// Cleanup global objects sau mỗi test
afterEach(() => {
  // Force garbage collection nếu có
  if (global.gc) {
    global.gc()
  }
})
