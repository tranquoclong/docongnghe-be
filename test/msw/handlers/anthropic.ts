import { http, HttpResponse } from 'msw'

export const anthropicHandlers = [
  // POST /v1/messages — non-streaming
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'msg_mock_001',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Xin chào! Tôi là trợ lý ảo của shop. Tôi có thể giúp gì cho bạn hôm nay? 😊',
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 50,
        output_tokens: 30,
      },
    })
  }),
]
