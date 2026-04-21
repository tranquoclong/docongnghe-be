import { z } from 'zod'

const AttachmentSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
  fileName: z.string().min(1).max(255),
  fileUrl: z.url(),
  fileSize: z
    .number()
    .max(100 * 1024 * 1024)
    .optional(), // 100MB max
  mimeType: z.string().optional(),
  thumbnail: z.url().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  duration: z.number().positive().optional(),
})

export const SendMessageDataSchema = z
  .object({
    conversationId: z.uuid(),
    content: z.string().max(10000).optional(),
    type: z
      .enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'CONTACT'])
      .optional()
      .default('TEXT'),
    replyToId: z.uuid().optional(),
    attachments: z.array(AttachmentSchema).max(10).optional(),
    tempId: z.string().optional(),
  })
  .refine((data) => data.content || (data.attachments && data.attachments.length > 0), {
    message: 'Message must have content or attachments',
  })

export const EditMessageDataSchema = z.object({
  messageId: z.uuid(),
  content: z.string().min(1).max(10000),
})

export const DeleteMessageDataSchema = z.object({
  messageId: z.uuid(),
  forEveryone: z.boolean().optional().default(false),
})

export const TypingDataSchema = z.object({
  conversationId: z.uuid(),
})

export const JoinConversationDataSchema = z.object({
  conversationId: z.uuid(),
})

export const LeaveConversationDataSchema = z.object({
  conversationId: z.uuid(),
})

export const MarkAsReadDataSchema = z.object({
  conversationId: z.uuid(),
  messageId: z.uuid().optional(),
})

export const ReactToMessageDataSchema = z.object({
  messageId: z.uuid(),
  emoji: z.string().min(1).max(10),
})

export const RemoveReactionDataSchema = z.object({
  messageId: z.uuid(),
  emoji: z.string().min(1).max(10),
})

// Input types (what client sends - allows optional fields with defaults)
export type SendMessageData = z.input<typeof SendMessageDataSchema>
export type EditMessageData = z.input<typeof EditMessageDataSchema>
export type DeleteMessageData = z.input<typeof DeleteMessageDataSchema>
export type TypingData = z.input<typeof TypingDataSchema>
export type JoinConversationData = z.input<typeof JoinConversationDataSchema>
export type LeaveConversationData = z.input<typeof LeaveConversationDataSchema>
export type MarkAsReadData = z.input<typeof MarkAsReadDataSchema>
export type ReactToMessageData = z.input<typeof ReactToMessageDataSchema>
export type RemoveReactionData = z.input<typeof RemoveReactionDataSchema>
export type Attachment = z.input<typeof AttachmentSchema>

// Output types (after validation - includes defaults)
export type SendMessageDataOutput = z.output<typeof SendMessageDataSchema>
export type DeleteMessageDataOutput = z.output<typeof DeleteMessageDataSchema>

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string }

export function validateWebSocketData<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
  }
}
