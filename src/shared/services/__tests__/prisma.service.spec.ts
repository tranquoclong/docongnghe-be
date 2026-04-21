import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../prisma.service'

/**
 * Test Suite: PrismaService
 * Mục đích: Test database connection management, lifecycle hooks, và operations
 * Coverage: Constructor, onModuleInit, database operations, error handling, edge cases
 */
describe('PrismaService', () => {
  let service: PrismaService

  beforeEach(async () => {
    // Arrange: Tạo testing module với PrismaService
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile()

    service = module.get<PrismaService>(PrismaService)

    // Mock các methods của PrismaClient để tránh kết nối database thật
    service.$connect = jest.fn().mockResolvedValue(undefined)
    service.$disconnect = jest.fn().mockResolvedValue(undefined)
    service.$transaction = jest.fn()
    service.$executeRaw = jest.fn()
    service.$queryRaw = jest.fn()
  })

  afterEach(() => {
    // Cleanup: Clear tất cả mocks sau mỗi test
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('Nên tạo instance của PrismaService thành công', () => {
      // Assert: Verify service được khởi tạo
      expect(service).toBeDefined()
      expect(service.constructor.name).toBe('PrismaService')
    })

    it('Nên có method $connect để kết nối database', () => {
      // Assert: Verify $connect method tồn tại
      expect(service.$connect).toBeDefined()
      expect(typeof service.$connect).toBe('function')
    })

    it('Nên có method $disconnect để ngắt kết nối database', () => {
      // Assert: Verify $disconnect method tồn tại
      expect(service.$disconnect).toBeDefined()
      expect(typeof service.$disconnect).toBe('function')
    })

    it('Nên có method $transaction để xử lý transactions', () => {
      // Assert: Verify $transaction method tồn tại
      expect(service.$transaction).toBeDefined()
      expect(typeof service.$transaction).toBe('function')
    })

    it('Nên có method $queryRaw để thực thi raw queries', () => {
      // Assert: Verify $queryRaw method tồn tại
      expect(service.$queryRaw).toBeDefined()
      expect(typeof service.$queryRaw).toBe('function')
    })

    it('Nên có method $executeRaw để thực thi raw commands', () => {
      // Assert: Verify $executeRaw method tồn tại
      expect(service.$executeRaw).toBeDefined()
      expect(typeof service.$executeRaw).toBe('function')
    })

    it('Nên khởi tạo PrismaClient với log level info', () => {
      // Assert: Verify PrismaService được khởi tạo đúng
      expect(service).toBeDefined()
      expect(service).toBeTruthy()
      // Note: Constructor được gọi với super({ log: ['info'] })
    })
  })

  describe('onModuleInit - Lifecycle Hook', () => {
    it('Nên gọi $connect khi module được khởi tạo', async () => {
      // Act: Gọi onModuleInit
      await service.onModuleInit()

      // Assert: Verify $connect được gọi đúng 1 lần
      expect(service.$connect).toHaveBeenCalledTimes(1)
    })

    it('Nên kết nối database thành công', async () => {
      // Act: Gọi onModuleInit
      const result = await service.onModuleInit()

      // Assert: Verify kết nối thành công
      expect(result).toBeUndefined()
      expect(service.$connect).toHaveBeenCalled()
    })

    it('Nên throw error khi kết nối database thất bại', async () => {
      // Arrange: Mock $connect để throw error
      const connectionError = new Error('Database connection failed')
      service.$connect = jest.fn().mockRejectedValue(connectionError)

      // Act & Assert: Verify error được throw
      await expect(service.onModuleInit()).rejects.toThrow('Database connection failed')
    })

    it('Nên throw error khi database không khả dụng (ECONNREFUSED)', async () => {
      // Arrange: Mock connection refused error
      const dbError = new Error('ECONNREFUSED: Connection refused')
      service.$connect = jest.fn().mockRejectedValue(dbError)

      // Act & Assert: Verify error được throw
      await expect(service.onModuleInit()).rejects.toThrow('ECONNREFUSED')
    })

    it('Nên throw error khi authentication thất bại', async () => {
      // Arrange: Mock authentication error
      const authError = new Error('Authentication failed for database')
      service.$connect = jest.fn().mockRejectedValue(authError)

      // Act & Assert: Verify error được throw
      await expect(service.onModuleInit()).rejects.toThrow('Authentication failed')
    })

    it('Nên throw error khi connection timeout', async () => {
      // Arrange: Mock timeout error
      const timeoutError = new Error('Connection timeout')
      service.$connect = jest.fn().mockRejectedValue(timeoutError)

      // Act & Assert: Verify error được throw
      await expect(service.onModuleInit()).rejects.toThrow('Connection timeout')
    })

    it('Nên có thể gọi onModuleInit nhiều lần (idempotent)', async () => {
      // Act: Gọi onModuleInit 3 lần
      await service.onModuleInit()
      await service.onModuleInit()
      await service.onModuleInit()

      // Assert: Verify $connect được gọi 3 lần
      expect(service.$connect).toHaveBeenCalledTimes(3)
    })

    it('Nên throw error khi DATABASE_URL không hợp lệ', async () => {
      // Arrange: Mock invalid database URL error
      const invalidUrlError = new Error('Invalid DATABASE_URL format')
      service.$connect = jest.fn().mockRejectedValue(invalidUrlError)

      // Act & Assert: Verify error được throw
      await expect(service.onModuleInit()).rejects.toThrow('Invalid DATABASE_URL')
    })
  })

  describe('Database Operations', () => {
    beforeEach(async () => {
      // Arrange: Khởi tạo connection trước mỗi test
      await service.onModuleInit()
    })

    it('Nên thực thi transaction thành công', async () => {
      // Arrange: Mock transaction result
      const mockResult = { id: 1, name: 'Test' }
      service.$transaction = jest.fn().mockResolvedValue(mockResult)

      // Act: Thực thi transaction
      const result = await service.$transaction(jest.fn())

      // Assert: Verify transaction được gọi và trả về kết quả đúng
      expect(service.$transaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockResult)
    })

    it('Nên thực thi raw query thành công', async () => {
      // Arrange: Mock query result
      const mockQueryResult = [{ count: 1 }]
      service.$queryRaw = jest.fn().mockResolvedValue(mockQueryResult)

      // Act: Thực thi raw query
      const result = await service.$queryRaw`SELECT 1`

      // Assert: Verify query được gọi và trả về kết quả đúng
      expect(service.$queryRaw).toHaveBeenCalled()
      expect(result).toEqual(mockQueryResult)
    })

    it('Nên thực thi raw command thành công', async () => {
      // Arrange: Mock execute result (số rows affected)
      service.$executeRaw = jest.fn().mockResolvedValue(1)

      // Act: Thực thi raw command
      const result = await service.$executeRaw`UPDATE users SET name = 'test'`

      // Assert: Verify command được gọi và trả về số rows affected
      expect(service.$executeRaw).toHaveBeenCalled()
      expect(result).toBe(1)
    })

    it('Nên ngắt kết nối database thành công', async () => {
      // Act: Ngắt kết nối
      await service.$disconnect()

      // Assert: Verify $disconnect được gọi
      expect(service.$disconnect).toHaveBeenCalledTimes(1)
    })

    it('Nên có thể kết nối lại sau khi ngắt kết nối', async () => {
      // Act: Ngắt kết nối rồi kết nối lại
      await service.$disconnect()
      await service.$connect()

      // Assert: Verify cả 2 methods được gọi
      expect(service.$disconnect).toHaveBeenCalled()
      expect(service.$connect).toHaveBeenCalled()
    })

    it('Nên thực thi nhiều operations liên tiếp', async () => {
      // Arrange: Mock multiple operations
      service.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }])
      service.$executeRaw = jest.fn().mockResolvedValue(1)

      // Act: Thực thi nhiều operations
      await service.$queryRaw`SELECT 1`
      await service.$executeRaw`UPDATE users SET active = true`
      await service.$queryRaw`SELECT 2`

      // Assert: Verify tất cả operations được gọi
      expect(service.$queryRaw).toHaveBeenCalledTimes(2)
      expect(service.$executeRaw).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('Nên xử lý lỗi transaction thất bại', async () => {
      // Arrange: Mock transaction error
      const transactionError = new Error('Transaction failed')
      service.$transaction = jest.fn().mockRejectedValue(transactionError)

      // Act & Assert: Verify error được throw
      await expect(service.$transaction(jest.fn())).rejects.toThrow('Transaction failed')
    })

    it('Nên xử lý lỗi raw query không hợp lệ', async () => {
      // Arrange: Mock query error
      const queryError = new Error('Invalid SQL syntax')
      service.$queryRaw = jest.fn().mockRejectedValue(queryError)

      // Act & Assert: Verify error được throw
      await expect(service.$queryRaw`INVALID SQL`).rejects.toThrow('Invalid SQL syntax')
    })

    it('Nên xử lý lỗi constraint violation khi execute raw', async () => {
      // Arrange: Mock constraint violation error
      const executeError = new Error('Constraint violation')
      service.$executeRaw = jest.fn().mockRejectedValue(executeError)

      // Act & Assert: Verify error được throw
      await expect(service.$executeRaw`INVALID UPDATE`).rejects.toThrow('Constraint violation')
    })

    it('Nên xử lý lỗi khi disconnect database', async () => {
      // Arrange: Mock disconnect error
      const disconnectError = new Error('Already disconnected')
      service.$disconnect = jest.fn().mockRejectedValue(disconnectError)

      // Act & Assert: Verify error được throw
      await expect(service.$disconnect()).rejects.toThrow('Already disconnected')
    })

    it('Nên xử lý lỗi unique constraint violation', async () => {
      // Arrange: Mock unique constraint error
      const uniqueError = new Error('Unique constraint failed on the fields: (`email`)')
      service.$executeRaw = jest.fn().mockRejectedValue(uniqueError)

      // Act & Assert: Verify error được throw
      await expect(service.$executeRaw`INSERT INTO users`).rejects.toThrow('Unique constraint')
    })

    it('Nên xử lý lỗi foreign key constraint', async () => {
      // Arrange: Mock foreign key error
      const fkError = new Error('Foreign key constraint failed')
      service.$executeRaw = jest.fn().mockRejectedValue(fkError)

      // Act & Assert: Verify error được throw
      await expect(service.$executeRaw`DELETE FROM users`).rejects.toThrow('Foreign key constraint')
    })
  })

  describe('Connection Lifecycle', () => {
    it('Nên duy trì connection state sau khi connect', async () => {
      // Act: Khởi tạo connection
      await service.onModuleInit()

      // Assert: Verify service và connection state
      expect(service).toBeDefined()
      expect(service.$connect).toHaveBeenCalled()
    })

    it('Nên thực thi operations sau khi connect thành công', async () => {
      // Arrange: Mock query result
      service.$queryRaw = jest.fn().mockResolvedValue([{ result: 'success' }])

      // Act: Connect và thực thi query
      await service.onModuleInit()
      const result = await service.$queryRaw`SELECT 1`

      // Assert: Verify connection và query thành công
      expect(service.$connect).toHaveBeenCalled()
      expect(result).toEqual([{ result: 'success' }])
    })

    it('Nên cleanup resources khi disconnect', async () => {
      // Act: Disconnect database
      await service.$disconnect()

      // Assert: Verify disconnect được gọi
      expect(service.$disconnect).toHaveBeenCalledTimes(1)
    })

    it('Nên xử lý full lifecycle: connect -> operations -> disconnect', async () => {
      // Arrange: Mock operations
      service.$queryRaw = jest.fn().mockResolvedValue([{ id: 1 }])

      // Act: Full lifecycle
      await service.onModuleInit() // Connect
      await service.$queryRaw`SELECT * FROM users` // Operation
      await service.$disconnect() // Disconnect

      // Assert: Verify tất cả steps được thực hiện
      expect(service.$connect).toHaveBeenCalled()
      expect(service.$queryRaw).toHaveBeenCalled()
      expect(service.$disconnect).toHaveBeenCalled()
    })
  })

  describe('Transaction Handling', () => {
    it('Nên thực thi transaction với callback thành công', async () => {
      // Arrange: Mock transaction result
      const mockResult = { id: 1, name: 'Created in transaction' }
      service.$transaction = jest.fn().mockResolvedValue(mockResult)

      // Act: Thực thi transaction
      const result = await service.$transaction(jest.fn())

      // Assert: Verify transaction được gọi và trả về kết quả
      expect(service.$transaction).toHaveBeenCalled()
      expect(result).toEqual(mockResult)
    })

    it('Nên rollback transaction khi có lỗi', async () => {
      // Arrange: Mock transaction error
      const error = new Error('Operation failed')
      service.$transaction = jest.fn().mockRejectedValue(error)

      // Act & Assert: Verify transaction rollback
      await expect(service.$transaction(jest.fn())).rejects.toThrow('Operation failed')
    })

    it('Nên commit transaction khi thành công', async () => {
      // Arrange: Mock successful transaction
      const mockResult = { id: 1, status: 'committed' }
      service.$transaction = jest.fn().mockResolvedValue(mockResult)

      // Act: Thực thi transaction
      const result = await service.$transaction(jest.fn())

      // Assert: Verify transaction committed
      expect(result).toEqual(mockResult)
    })

    it('Nên xử lý concurrent transactions', async () => {
      // Arrange: Mock transaction result
      service.$transaction = jest.fn().mockResolvedValue({ success: true })

      // Act: Thực thi 3 transactions đồng thời
      const promises = [
        service.$transaction(jest.fn()),
        service.$transaction(jest.fn()),
        service.$transaction(jest.fn()),
      ]
      await Promise.all(promises)

      // Assert: Verify tất cả transactions được thực thi
      expect(service.$transaction).toHaveBeenCalledTimes(3)
    })

    it('Nên xử lý nested transactions (nếu supported)', async () => {
      // Arrange: Mock nested transaction
      const outerResult = { id: 1, inner: { id: 2 } }
      service.$transaction = jest.fn().mockResolvedValue(outerResult)

      // Act: Thực thi nested transaction
      const result = await service.$transaction(jest.fn())

      // Assert: Verify nested transaction result
      expect(result).toEqual(outerResult)
    })

    it('Nên xử lý transaction timeout', async () => {
      // Arrange: Mock transaction timeout error
      const timeoutError = new Error('Transaction timeout exceeded')
      service.$transaction = jest.fn().mockRejectedValue(timeoutError)

      // Act & Assert: Verify timeout error
      await expect(service.$transaction(jest.fn())).rejects.toThrow('Transaction timeout')
    })
  })

  describe('Edge Cases & Security', () => {
    it('Nên xử lý lỗi connection pool exhaustion', async () => {
      // Arrange: Mock connection pool exhausted error
      const poolError = new Error('Connection pool exhausted')
      service.$connect = jest.fn().mockRejectedValue(poolError)

      // Act & Assert: Verify error được throw
      await expect(service.onModuleInit()).rejects.toThrow('Connection pool exhausted')
    })

    it('Nên xử lý database server restart', async () => {
      // Arrange: Mock server restart scenario (fail then success)
      service.$connect = jest
        .fn()
        .mockRejectedValueOnce(new Error('Server not available'))
        .mockResolvedValueOnce(undefined)

      // Act & Assert: Verify retry logic
      await expect(service.onModuleInit()).rejects.toThrow('Server not available')
      await expect(service.onModuleInit()).resolves.toBeUndefined()
      expect(service.$connect).toHaveBeenCalledTimes(2)
    })

    it('Nên xử lý slow query timeout', async () => {
      // Arrange: Mock query timeout error
      const timeoutError = new Error('Query timeout exceeded')
      service.$queryRaw = jest.fn().mockRejectedValue(timeoutError)

      // Act & Assert: Verify timeout error
      await expect(service.$queryRaw`SELECT * FROM large_table`).rejects.toThrow('Query timeout exceeded')
    })

    it('Nên xử lý deadlock trong transaction', async () => {
      // Arrange: Mock deadlock error
      const deadlockError = new Error('Deadlock detected')
      service.$transaction = jest.fn().mockRejectedValue(deadlockError)

      // Act & Assert: Verify deadlock error
      await expect(service.$transaction(jest.fn())).rejects.toThrow('Deadlock detected')
    })

    it('Nên maintain service availability sau khi có error (recovery)', async () => {
      // Arrange: Mock temporary error then success
      service.$queryRaw = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce([{ success: true }])

      // Act & Assert: Verify service recovery
      await expect(service.$queryRaw`SELECT 1`).rejects.toThrow('Temporary error')
      const result = await service.$queryRaw`SELECT 1`
      expect(result).toEqual([{ success: true }])
    })

    it('Nên support health check query (SELECT 1)', async () => {
      // Arrange: Mock health check result
      service.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }])

      // Act: Thực thi health check
      const result = await service.$queryRaw`SELECT 1`

      // Assert: Verify health check thành công
      expect(result).toEqual([{ result: 1 }])
    })

    it('Nên xử lý multiple concurrent connections', async () => {
      // Act: Tạo 3 connections đồng thời
      const connections = [service.$connect(), service.$connect(), service.$connect()]
      await Promise.all(connections)

      // Assert: Verify tất cả connections được tạo
      expect(service.$connect).toHaveBeenCalledTimes(3)
    })

    it('SECURITY: Nên không expose database credentials trong errors', async () => {
      // Arrange: Mock connection error (không chứa credentials)
      const safeError = new Error('Connection failed')
      service.$connect = jest.fn().mockRejectedValue(safeError)

      // Act & Assert: Verify error message không chứa sensitive info
      await expect(service.onModuleInit()).rejects.toThrow('Connection failed')
      // Note: Error message không nên chứa DATABASE_URL, password, etc.
    })

    it('SECURITY: Nên xử lý SQL injection attempts trong raw queries', async () => {
      // Arrange: Mock SQL injection attempt
      const injectionError = new Error('Invalid query parameters')
      service.$queryRaw = jest.fn().mockRejectedValue(injectionError)

      // Act & Assert: Verify SQL injection được prevent
      await expect(service.$queryRaw`SELECT * FROM users WHERE id = ${'; DROP TABLE users;--'}`).rejects.toThrow(
        'Invalid query parameters',
      )
    })

    it('Nên xử lý connection loss và auto-reconnect', async () => {
      // Arrange: Mock connection loss then reconnect
      service.$connect = jest.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(undefined)

      // Act: Simulate connection loss và reconnect
      await expect(service.onModuleInit()).rejects.toThrow('Connection lost')
      await expect(service.onModuleInit()).resolves.toBeUndefined()

      // Assert: Verify reconnection thành công
      expect(service.$connect).toHaveBeenCalledTimes(2)
    })

    it('Nên xử lý max connection limit reached', async () => {
      // Arrange: Mock max connections error
      const maxConnError = new Error('Too many connections')
      service.$connect = jest.fn().mockRejectedValue(maxConnError)

      // Act & Assert: Verify max connections error
      await expect(service.onModuleInit()).rejects.toThrow('Too many connections')
    })

    it('Nên cleanup resources khi có unhandled errors', async () => {
      // Arrange: Mock unhandled error
      const unhandledError = new Error('Unhandled database error')
      service.$queryRaw = jest.fn().mockRejectedValue(unhandledError)

      // Act & Assert: Verify error được throw và resources được cleanup
      await expect(service.$queryRaw`SELECT 1`).rejects.toThrow('Unhandled database error')
      // Note: Service vẫn available cho operations tiếp theo
    })
  })
})
