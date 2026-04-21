import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodResponse } from 'nestjs-zod'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import {
  AddMembersBodyDTO,
  ConversationMessageResDTO,
  ConversationParamsDTO,
  ConversationServiceResDTO,
  ConversationsListResDTO,
  CreateDirectConversationBodyDTO,
  CreateGroupConversationBodyDTO,
  GetConversationsQueryDTO,
  GetMessagesQueryDTO,
  MarkAsReadBodyDTO,
  MemberParamsDTO,
  MessageParamsDTO,
  MessageResponseDTO,
  MessageSearchResultResDTO,
  MessagesListResDTO,
  SearchMessagesQueryDTO,
  SendMessageBodyDTO,
  UpdateConversationBodyDTO,
} from './conversation.dto'
import { ConversationService } from './conversation.service'
import { MessageService } from './message.service'

@Controller('conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  // ===== CONVERSATION MANAGEMENT =====

  @Get()
  @ZodResponse({ type: ConversationsListResDTO as any })
  async getConversations(@ActiveUser('userId') userId: number, @Query() query: GetConversationsQueryDTO) {
    return this.conversationService.getUserConversations(userId, query)
  }

  @Get('stats')
  @ZodResponse({ type: MessageResponseDTO })
  async getConversationStats(@ActiveUser('userId') userId: number) {
    const stats = await this.conversationService.getConversationStats(userId)
    return { message: 'Thống kê cuộc trò chuyện', data: stats }
  }

  @Get(':conversationId')
  @ZodResponse({ type: ConversationServiceResDTO as any })
  async getConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.getConversationById(params.conversationId, userId)
  }

  @Post('direct')
  @ZodResponse({ type: ConversationServiceResDTO as any })
  async createDirectConversation(@ActiveUser('userId') userId: number, @Body() body: CreateDirectConversationBodyDTO) {
    return this.conversationService.createDirectConversation(userId, body.recipientId)
  }

  @Post('group')
  @ZodResponse({ type: ConversationServiceResDTO as any })
  async createGroupConversation(@ActiveUser('userId') userId: number, @Body() body: CreateGroupConversationBodyDTO) {
    return this.conversationService.createGroupConversation(userId, body)
  }

  @Put(':conversationId')
  @ZodResponse({ type: ConversationServiceResDTO as any })
  async updateConversation(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Body() body: UpdateConversationBodyDTO,
  ) {
    return this.conversationService.updateConversation(params.conversationId, userId, body)
  }

  @Post(':conversationId/archive')
  @ZodResponse({ type: MessageResponseDTO })
  async archiveConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.archiveConversation(params.conversationId, userId)
  }

  @Post(':conversationId/unarchive')
  @ZodResponse({ type: MessageResponseDTO })
  async unarchiveConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.unarchiveConversation(params.conversationId, userId)
  }

  @Post(':conversationId/mute')
  @ZodResponse({ type: MessageResponseDTO })
  async muteConversation(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Body() body: { mutedUntil?: string },
  ) {
    const mutedUntil = body.mutedUntil ? new Date(body.mutedUntil) : undefined
    return this.conversationService.muteConversation(params.conversationId, userId, mutedUntil)
  }

  @Post(':conversationId/unmute')
  @ZodResponse({ type: MessageResponseDTO })
  async unmuteConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.unmuteConversation(params.conversationId, userId)
  }

  @Delete(':conversationId/leave')
  @ZodResponse({ type: MessageResponseDTO })
  async leaveConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.leaveConversation(params.conversationId, userId)
  }

  // ===== MEMBER MANAGEMENT =====

  @Get(':conversationId/members')
  @ZodResponse({ type: MessageResponseDTO })
  async getConversationMembers(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    const members = await this.conversationService.getConversationMembers(params.conversationId, userId)
    return { message: 'Danh sách thành viên', data: members }
  }

  @Post(':conversationId/members')
  @ZodResponse({ type: ConversationServiceResDTO as any })
  async addMembers(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Body() body: AddMembersBodyDTO,
  ) {
    return this.conversationService.addMembers(params.conversationId, userId, body.memberIds)
  }

  @Delete(':conversationId/members/:memberId')
  @ZodResponse({ type: MessageResponseDTO })
  async removeMember(@ActiveUser('userId') userId: number, @Param() params: MemberParamsDTO) {
    return this.conversationService.removeMember(params.conversationId, userId, params.memberId)
  }

  @Put(':conversationId/members/:memberId/role')
  @ZodResponse({ type: MessageResponseDTO })
  async updateMemberRole(
    @ActiveUser('userId') userId: number,
    @Param() params: MemberParamsDTO,
    @Body() body: { role: 'ADMIN' | 'MODERATOR' | 'MEMBER' },
  ) {
    return this.conversationService.updateMemberRole(params.conversationId, userId, params.memberId, body.role)
  }

  // ===== MESSAGE MANAGEMENT =====

  @Get(':conversationId/messages')
  @ZodResponse({ type: MessagesListResDTO as any })
  async getMessages(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Query() query: GetMessagesQueryDTO,
  ) {
    return this.messageService.getConversationMessages(params.conversationId, userId, query)
  }

  @Get(':conversationId/messages/stats')
  @ZodResponse({ type: MessageResponseDTO })
  async getMessageStats(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    const stats = await this.messageService.getMessageStats(params.conversationId, userId)
    return { message: 'Thống kê tin nhắn', data: stats }
  }

  @Get('messages/search')
  @ZodResponse({ type: MessageSearchResultResDTO as any })
  async searchMessages(@ActiveUser('userId') userId: number, @Query() query: SearchMessagesQueryDTO) {
    return this.messageService.searchMessages(userId, query.q, {
      limit: query.limit,
      cursor: query.cursor,
      type: query.type,
      fromUserId: query.fromUserId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    })
  }

  @Post('messages')
  @ZodResponse({ type: ConversationMessageResDTO as any })
  async sendMessage(@ActiveUser('userId') userId: number, @Body() body: SendMessageBodyDTO) {
    return this.messageService.sendMessage(userId, body)
  }

  @Get('messages/:messageId')
  @ZodResponse({ type: ConversationMessageResDTO as any })
  async getMessage(@ActiveUser('userId') userId: number, @Param() params: MessageParamsDTO) {
    return this.messageService.getMessageById(params.messageId, userId)
  }

  @Put('messages/:messageId')
  @ZodResponse({ type: ConversationMessageResDTO as any })
  async editMessage(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Body() body: { content: string },
  ) {
    return this.messageService.editMessage(params.messageId, userId, body.content)
  }

  @Delete('messages/:messageId')
  @ZodResponse({ type: ConversationMessageResDTO as any })
  async deleteMessage(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Query('forEveryone') forEveryone?: string,
  ) {
    const deleteForEveryone = forEveryone === 'true'
    return this.messageService.deleteMessage(params.messageId, userId, deleteForEveryone)
  }

  // ===== MESSAGE INTERACTIONS =====

  @Post('messages/read')
  @ZodResponse({ type: MessageResponseDTO })
  async markAsRead(@ActiveUser('userId') userId: number, @Body() body: MarkAsReadBodyDTO) {
    const result = await this.messageService.markAsRead(body.conversationId, userId, body.messageId)
    return { message: `Đã đánh dấu ${result.markedCount} tin nhắn là đã đọc` }
  }

  @Post('messages/:messageId/react')
  @ZodResponse({ type: MessageResponseDTO })
  async reactToMessage(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Body() body: { emoji: string },
  ) {
    const result = await this.messageService.reactToMessage(params.messageId, userId, body.emoji)
    return {
      message: result.action === 'added' ? 'Đã thêm reaction' : 'Đã xóa reaction',
      data: result,
    }
  }

  @Delete('messages/:messageId/react')
  @ZodResponse({ type: MessageResponseDTO })
  async removeReaction(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Query('emoji') emoji: string,
  ) {
    return this.messageService.removeReaction(params.messageId, userId, emoji)
  }

  @Get('messages/:messageId/reactions/stats')
  @ZodResponse({ type: MessageResponseDTO })
  async getReactionStats(@ActiveUser('userId') userId: number, @Param() params: MessageParamsDTO) {
    const stats = await this.messageService.getReactionStats(params.messageId, userId)
    return { message: 'Thống kê reaction', data: stats }
  }

  @Get('messages/:messageId/read-receipts/stats')
  @ZodResponse({ type: MessageResponseDTO })
  async getReadReceiptStats(@ActiveUser('userId') userId: number, @Param() params: MessageParamsDTO) {
    const stats = await this.messageService.getReadReceiptStats(params.messageId, userId)
    return { message: 'Thống kê đã đọc', data: stats }
  }
}
