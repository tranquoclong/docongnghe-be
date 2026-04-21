import { Test, TestingModule } from '@nestjs/testing'
import { Server } from 'socket.io'
import { ChatGateway } from '../chat.gateway'

/**
 * CHAT GATEWAY UNIT TESTS
 *
 * Test coverage cho Simple Chat Gateway
 * - Message handling (send-message event)
 * - Server broadcasting
 * - Event emission
 * - Basic WebSocket functionality
 */

describe('ChatGateway', () => {
  let gateway: ChatGateway
  let mockServer: jest.Mocked<Server>

  beforeEach(async () => {
    // Mock Socket.IO Server - only mock methods actually used by ChatGateway
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map(),
      },
    } as unknown as jest.Mocked<Server>

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatGateway],
    }).compile()

    gateway = module.get<ChatGateway>(ChatGateway)
    gateway.server = mockServer
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== INITIALIZATION =====

  describe('Gateway Initialization', () => {
    it('should be defined', () => {
      expect(gateway).toBeDefined()
    })

    it('should have server instance', () => {
      expect(gateway.server).toBeDefined()
      expect(gateway.server).toBe(mockServer)
    })

    it('should be configured with chat namespace', () => {
      // Verify the @WebSocketGateway decorator metadata contains namespace 'chat'
      const isGateway = Reflect.getMetadata('websockets:is_gateway', ChatGateway)
      const gatewayOptions = Reflect.getMetadata('websockets:gateway_options', ChatGateway)
      expect(isGateway).toBe(true)
      expect(gatewayOptions).toEqual({ namespace: 'chat' })
    })
  })

  // ===== MESSAGE HANDLING =====

  describe('handleEvent (send-message)', () => {
    describe('✅ Success Cases', () => {
      it('should handle send-message event and return data', () => {
        const testData = 'World'

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
      })

      it('should emit receive-message event with formatted data', () => {
        const testData = 'World'

        gateway.handleEvent(testData)

        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: 'Hello World',
        })
        expect(mockServer.emit).toHaveBeenCalledTimes(1)
      })

      it('should handle empty string message', () => {
        const testData = ''

        const result = gateway.handleEvent(testData)

        expect(result).toBe('')
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: 'Hello ',
        })
      })

      it('should handle message with special characters', () => {
        const testData = 'Test!@#$%^&*()'

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: 'Hello Test!@#$%^&*()',
        })
      })

      it('should handle long message', () => {
        const testData = 'A'.repeat(1000)

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: `Hello ${testData}`,
        })
      })

      it('should handle message with unicode characters', () => {
        const testData = 'Xin chào 你好 こんにちは 🎉'

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: `Hello ${testData}`,
        })
      })

      it('should handle message with newlines', () => {
        const testData = 'Line 1\nLine 2\nLine 3'

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: `Hello ${testData}`,
        })
      })
    })

    describe('🔄 Multiple Messages', () => {
      it('should handle multiple consecutive messages', () => {
        const messages = ['Message 1', 'Message 2', 'Message 3']

        messages.forEach((msg) => {
          gateway.handleEvent(msg)
        })

        expect(mockServer.emit).toHaveBeenCalledTimes(3)
        expect(mockServer.emit).toHaveBeenNthCalledWith(1, 'receive-message', {
          data: 'Hello Message 1',
        })
        expect(mockServer.emit).toHaveBeenNthCalledWith(2, 'receive-message', {
          data: 'Hello Message 2',
        })
        expect(mockServer.emit).toHaveBeenNthCalledWith(3, 'receive-message', {
          data: 'Hello Message 3',
        })
      })

      it('should handle rapid message sending', () => {
        const count = 10

        for (let i = 0; i < count; i++) {
          gateway.handleEvent(`Message ${i}`)
        }

        expect(mockServer.emit).toHaveBeenCalledTimes(count)
      })
    })

    describe('⚡ Edge Cases', () => {
      it('should handle null-like string', () => {
        const testData = 'null'

        const result = gateway.handleEvent(testData)

        expect(result).toBe('null')
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: 'Hello null',
        })
      })

      it('should handle undefined-like string', () => {
        const testData = 'undefined'

        const result = gateway.handleEvent(testData)

        expect(result).toBe('undefined')
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: 'Hello undefined',
        })
      })

      it('should handle numeric string', () => {
        const testData = '12345'

        const result = gateway.handleEvent(testData)

        expect(result).toBe('12345')
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: 'Hello 12345',
        })
      })

      it('should handle JSON-like string', () => {
        const testData = '{"key":"value"}'

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: `Hello ${testData}`,
        })
      })

      it('should handle HTML-like string', () => {
        const testData = '<script>alert("XSS")</script>'

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: `Hello ${testData}`,
        })
      })

      it('should handle whitespace-only message', () => {
        const testData = '   '

        const result = gateway.handleEvent(testData)

        expect(result).toBe(testData)
        expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
          data: `Hello ${testData}`,
        })
      })
    })
  })

  // ===== SERVER BROADCASTING =====

  describe('Server Broadcasting', () => {
    it('should broadcast to all connected clients', () => {
      gateway.handleEvent('Broadcast test')

      // Verify emit được gọi (broadcast to all)
      expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
        data: 'Hello Broadcast test',
      })
    })

    it('should be able to emit custom events through server', () => {
      gateway.server.emit('custom-event', { test: 'data' })

      expect(mockServer.emit).toHaveBeenCalledWith('custom-event', { test: 'data' })
    })

    it('should maintain server reference throughout lifecycle', () => {
      const initialServer = gateway.server

      gateway.handleEvent('Test')

      expect(gateway.server).toBe(initialServer)
      expect(gateway.server).toBe(mockServer)
    })
  })

  // ===== INTEGRATION SCENARIOS =====

  describe('Integration Scenarios', () => {
    it('should handle message flow: receive -> process -> broadcast', () => {
      const inputMessage = 'Integration Test'

      // Receive message
      const result = gateway.handleEvent(inputMessage)

      // Verify processing (return original data)
      expect(result).toBe(inputMessage)

      // Verify broadcasting
      expect(mockServer.emit).toHaveBeenCalledWith('receive-message', {
        data: `Hello ${inputMessage}`,
      })
    })

    it('should support event-driven architecture', () => {
      // Simulate multiple clients sending messages
      const client1Message = 'Client 1'
      const client2Message = 'Client 2'

      gateway.handleEvent(client1Message)
      gateway.handleEvent(client2Message)

      expect(mockServer.emit).toHaveBeenCalledTimes(2)
    })

    it('should maintain stateless behavior between messages', () => {
      gateway.handleEvent('Message 1')
      const result1 = mockServer.emit.mock.calls[0]

      jest.clearAllMocks()

      gateway.handleEvent('Message 2')
      const result2 = mockServer.emit.mock.calls[0]

      // Verify each message is processed independently
      expect(result1).not.toEqual(result2)
    })
  })
})
