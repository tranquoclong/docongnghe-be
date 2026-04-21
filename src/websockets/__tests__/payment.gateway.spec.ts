import { Test, TestingModule } from '@nestjs/testing'
import { Server } from 'socket.io'
import { PaymentGateway } from '../payment.gateway'

/**
 * PAYMENT GATEWAY UNIT TESTS
 *
 * Test coverage cho Payment WebSocket Gateway
 * - Message handling (send-money event)
 * - Server broadcasting
 * - Event emission
 */

describe('PaymentGateway', () => {
  let gateway: PaymentGateway
  let mockServer: jest.Mocked<Server>

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Server>

    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentGateway],
    }).compile()

    gateway = module.get<PaymentGateway>(PaymentGateway)
    gateway.server = mockServer
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('handleEvent', () => {
    it('should handle send-money event and broadcast receive-money', () => {
      const data = '100000'

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money: 100000',
      })
      expect(result).toBe('100000')
    })

    it('should handle empty string data', () => {
      const data = ''

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money: ',
      })
      expect(result).toBe('')
    })

    it('should handle numeric string data', () => {
      const data = '500'

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money: 500',
      })
      expect(result).toBe('500')
    })

    it('should handle large amount data', () => {
      const data = '999999999'

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money: 999999999',
      })
      expect(result).toBe('999999999')
    })

    it('should handle special characters in data', () => {
      const data = '100.50'

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money: 100.50',
      })
      expect(result).toBe('100.50')
    })

    it('should broadcast to all connected clients', () => {
      const data = '1000'

      gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledTimes(1)
      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', expect.any(Object))
    })

    it('should format message correctly', () => {
      const data = '250000'

      gateway.handleEvent(data)

      const emitCall = mockServer.emit.mock.calls[0]
      expect(emitCall[0]).toBe('receive-money')
      expect(emitCall[1]).toEqual({
        data: 'Money: 250000',
      })
    })

    it('should return original data unchanged', () => {
      const data = '12345'

      const result = gateway.handleEvent(data)

      expect(result).toBe(data)
      expect(result).not.toBe('Money: 12345')
    })
  })

  describe('server initialization', () => {
    it('should have server instance', () => {
      expect(gateway.server).toBeDefined()
      expect(gateway.server).toBe(mockServer)
    })

    it('should be able to emit events through server', () => {
      gateway.server.emit('test-event', { test: 'data' })

      expect(mockServer.emit).toHaveBeenCalledWith('test-event', { test: 'data' })
    })
  })

  describe('WebSocket namespace', () => {
    it('should be configured with payment namespace', () => {
      const isGateway = Reflect.getMetadata('websockets:is_gateway', PaymentGateway)
      const gatewayOptions = Reflect.getMetadata('websockets:gateway_options', PaymentGateway)
      expect(isGateway).toBe(true)
      expect(gatewayOptions).toEqual({ namespace: 'payment' })
    })
  })

  describe('event handling flow', () => {
    it('should complete full event flow: receive -> process -> broadcast', () => {
      const inputData = '75000'

      // Receive event
      const result = gateway.handleEvent(inputData)

      // Process and broadcast
      expect(mockServer.emit).toHaveBeenCalled()

      // Return result
      expect(result).toBe(inputData)
    })

    it('should handle multiple sequential events', () => {
      const amounts = ['100', '200', '300']

      amounts.forEach((amount) => {
        const result = gateway.handleEvent(amount)
        expect(result).toBe(amount)
      })

      expect(mockServer.emit).toHaveBeenCalledTimes(3)
    })

    it('should maintain correct event data structure', () => {
      const data = '50000'

      gateway.handleEvent(data)

      const [[eventName, eventData]] = mockServer.emit.mock.calls
      expect(eventName).toBe('receive-money')
      expect(eventData).toHaveProperty('data')
      expect(eventData.data).toContain('Money:')
      expect(eventData.data).toContain(data)
    })
  })

  describe('edge cases', () => {
    it('should handle zero amount', () => {
      const data = '0'

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money: 0',
      })
      expect(result).toBe('0')
    })

    it('should handle negative amount (if allowed)', () => {
      const data = '-100'

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money: -100',
      })
      expect(result).toBe('-100')
    })

    it('should handle very long string', () => {
      const data = '1'.repeat(100)

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: `Money: ${data}`,
      })
      expect(result).toBe(data)
    })

    it('should handle whitespace in data', () => {
      const data = '  1000  '

      const result = gateway.handleEvent(data)

      expect(mockServer.emit).toHaveBeenCalledWith('receive-money', {
        data: 'Money:   1000  ',
      })
      expect(result).toBe('  1000  ')
    })
  })

  describe('performance', () => {
    it('should handle rapid successive events', () => {
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        gateway.handleEvent(i.toString())
      }

      expect(mockServer.emit).toHaveBeenCalledTimes(iterations)
    })

    it('should not accumulate state between events', () => {
      gateway.handleEvent('100')
      gateway.handleEvent('200')

      const lastCall = mockServer.emit.mock.calls[1]
      expect(lastCall[1].data).toBe('Money: 200')
      expect(lastCall[1].data).not.toContain('100')
    })
  })
})
