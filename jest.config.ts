import type { Config } from 'jest'

const config: Config = {
  // Basic configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test discovery - loại bỏ integration tests khỏi mặc định
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', 'test/integration/', 'test/e2e/'],
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest',
  },
  // Allow ts-jest to transform ESM packages (MSW v2 and its deps)
  // Must handle pnpm's .pnpm directory structure on both Unix and Windows
  transformIgnorePatterns: [
    '<rootDir>/node_modules/.pnpm/(?!(msw|until-async|@mswjs))',
  ],

  // Module resolution - fix để support src/* imports
  rootDir: '.',
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.(t|j)s?(x)',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.model.ts',
    '!src/**/*.error.ts',
    '!src/**/*.constant.ts',
    '!src/main.ts',
    // Exclude test/demo modules and boilerplate files
    '!src/routes/payment_test/**',
    '!src/websockets/**/*.old.ts',
    '!src/**/*.module.ts',
    '!src/shared/config.ts',
    '!src/shared/modules/**',
    // Exclude BullMQ producer files — thin queue infrastructure wrappers, not business logic
    '!src/**/*.producer.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Critical modules — highest coverage expectations
    './src/routes/auth/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/routes/payment/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/routes/order/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    // Business modules — strong coverage expectations
    './src/routes/product/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/routes/cart/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/routes/wishlist/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/routes/voucher/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Setup files for unit tests
  setupFilesAfterEnv: ['<rootDir>/test/setup.unit.ts'],

  // Test timeout
  testTimeout: 30000,

  // Force exit để tránh worker process hang
  forceExit: true,
  detectOpenHandles: true,

  // Parallel execution - giảm workers để tránh memory overflow
  maxWorkers: process.env.CI ? 2 : '50%', // Use 50% of cores locally, 2 in CI

  // Verbose output for debugging
  verbose: false,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Memory management
  logHeapUsage: true,
}

export default config
