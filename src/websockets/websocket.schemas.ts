import { z } from 'zod'

// ===== MESSAGE EVENT SCHEMAS =====

export const AttachmentSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
  fileName: z.string().min(1).max(255),
  fileUrl: z.url(),
  fileSize: z.number().positive().optional(),
  mimeType: z.string().max(100).optional(),
  thumbnail: z.url().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  duration: z.number().positive().optional(),
})

export const SendMessageDataSchema = z.object({
  conversationId: z.uuid(),
  content: z.string().max(10000).optional(),
  type: z
    .enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'CONTACT'])
    .optional()
    .default('TEXT'),
  replyToId: z.uuid().optional(),
  attachments: z.array(AttachmentSchema).max(10).optional(),
  tempId: z.string().max(100).optional(),
})

export const EditMessageDataSchema = z.object({
  messageId: z.uuid(),
  content: z.string().min(1).max(10000),
})

export const DeleteMessageDataSchema = z.object({
  messageId: z.uuid(),
  forEveryone: z.boolean().optional().default(false),
})

// ===== TYPING EVENT SCHEMAS =====

export const TypingDataSchema = z.object({
  conversationId: z.uuid(),
})

// ===== INTERACTION EVENT SCHEMAS =====

export const JoinConversationDataSchema = z.object({
  conversationId: z.uuid(),
})

export const MarkAsReadDataSchema = z.object({
  conversationId: z.uuid(),
  messageId: z.uuid().optional(),
})

// Emoji validation: allow standard emoji characters and common emoji shortcodes
export const ReactToMessageDataSchema = z.object({
  messageId: z.uuid(),
  emoji: z
    .string()
    .min(1)
    .max(50)
    .refine(
      (val) => {
        // Allow emoji characters or shortcodes like :thumbsup:
        const emojiRegex =
          /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]+$/u
        const shortcodeRegex = /^:[a-z0-9_+-]+:$/i
        return emojiRegex.test(val) || shortcodeRegex.test(val)
      },
      { message: 'Invalid emoji format' },
    ),
})

// ===== TYPE EXPORTS =====

// Input types (what client sends - allows optional fields with defaults)
export type SendMessageDataType = z.input<typeof SendMessageDataSchema>
export type EditMessageDataType = z.input<typeof EditMessageDataSchema>
export type DeleteMessageDataType = z.input<typeof DeleteMessageDataSchema>
export type TypingDataType = z.input<typeof TypingDataSchema>
export type JoinConversationDataType = z.input<typeof JoinConversationDataSchema>
export type MarkAsReadDataType = z.input<typeof MarkAsReadDataSchema>
export type ReactToMessageDataType = z.input<typeof ReactToMessageDataSchema>

// Output types (after validation - includes defaults)
export type SendMessageDataOutput = z.output<typeof SendMessageDataSchema>
export type DeleteMessageDataOutput = z.output<typeof DeleteMessageDataSchema>

// ===== VALIDATION HELPER =====

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Validate WebSocket event data against a Zod schema
 * Returns validated data or error message
 */
export function validateWebSocketData<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  // Format error message from Zod issues
  const errorMessages = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join('; ')
  return { success: false, error: errorMessages }
}
