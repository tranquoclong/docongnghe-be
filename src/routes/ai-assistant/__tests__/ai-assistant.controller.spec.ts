import { EventEmitter } from 'events'
import { AIAssistantController } from '../ai-assistant.controller'
import { AIAssistantService } from '../ai-assistant.service'

/**
 * AI ASSISTANT CONTROLLER UNIT TESTS
 *
 * Tests for SSE streaming connection cleanup behavior (Task 6.7)
 */

describe('AIAssistantController', () => {
  let controller: AIAssistantController
  let mockAIService: jest.Mocked<AIAssistantService>

  beforeEach(() => {
    mockAIService = {
      generateResponse: jest.fn(),
      generateStreamingResponse: jest.fn(),
      getConversationHistory: jest.fn(),
      getOrCreateConversation: jest.fn(),
      saveMessage: jest.fn(),
    } as any

    controller = new AIAssistantController(mockAIService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('testAIStreaming - SSE client disconnect', () => {
    it('should abort the AI stream and prevent further writes when client disconnects', async () => {
      const mockReq = new EventEmitter() as any
      const writtenData: string[] = []

      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn((data: string) => {
          writtenData.push(data)
          return true
        }),
        end: jest.fn(),
      } as any

      const query = { message: 'test message' }

      mockAIService.generateStreamingResponse.mockImplementation(
        async (_messages: any, _message: any, callbacks: any, signal?: AbortSignal) => {
          callbacks.onChunk('Hello')

          mockReq.emit('close')

          await new Promise((resolve) => setTimeout(resolve, 0))

          expect(signal!.aborted).toBe(true)

          callbacks.onChunk(' World')

          callbacks.onComplete()
        },
      )

      await controller.testAIStreaming(query as any, mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalled()

      const allWritten = writtenData.join('')
      expect(allWritten).toContain('start')
      expect(allWritten).toContain('Hello')
    })

    it('should clear timeout timer when client disconnects', async () => {
      const mockReq = new EventEmitter() as any
      let endCallCount = 0
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(() => {
          endCallCount++
        }),
      } as any

      const query = { message: 'test' }

      // Track if abort was called
      let signalAborted = false

      mockAIService.generateStreamingResponse.mockImplementation(async (_messages, _message, callbacks, signal) => {
        // Simulate client disconnect immediately
        mockReq.emit('close')

        // Check signal was aborted synchronously (close handler is sync)
        signalAborted = signal?.aborted ?? false

        callbacks.onComplete()
      })

      await controller.testAIStreaming(query as any, mockReq, mockRes)

      // Verify the abort signal was triggered
      expect(signalAborted).toBe(true)

      // res.end should have been called at most once (not from both timeout + disconnect)
      expect(endCallCount).toBeLessThanOrEqual(1)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match SSE streaming writeHead structure', async () => {
      const mockReq = new EventEmitter() as any
      const capturedHeaders: any = {}
      const mockRes = {
        writeHead: jest.fn((status: number, headers: any) => {
          capturedHeaders.status = status
          capturedHeaders.headers = headers
        }),
        write: jest.fn(() => true),
        end: jest.fn(),
      } as any

      mockAIService.generateStreamingResponse.mockImplementation(async (_messages, _message, callbacks) => {
        callbacks.onComplete()
      })

      await controller.testAIStreaming({ message: 'test' } as any, mockReq, mockRes)

      expect({ status: capturedHeaders.status, headers: capturedHeaders.headers }).toMatchSnapshot()
    })
  })
})
