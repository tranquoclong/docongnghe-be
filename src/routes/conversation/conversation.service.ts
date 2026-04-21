import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ConversationRole, UserStatus } from '@prisma/client'
import { ConversationRepository } from './conversation.repo'
import { MessageRepository } from './message.repo'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly userRepo: SharedUserRepository,
  ) {}

  // ===== CONVERSATION MANAGEMENT =====

  async getUserConversations(
    userId: number,
    options: {
      page: number
      limit: number
      type?: 'DIRECT' | 'GROUP'
      search?: string
      isArchived?: boolean
    },
  ) {
    const result = await this.conversationRepo.findUserConversations(userId, options)

    // Enrich conversations with computed fields
    const enrichedConversations = result.data.map((conversation) => {
      const currentUserMember = conversation.members.find((m) => m.userId === userId)
      const unreadCount = currentUserMember?.unreadCount || 0
      const currentUserRole = currentUserMember?.role || null
      const isCurrentUserAdmin = currentUserRole === 'ADMIN'
      const memberCount = conversation.members.length

      // For direct conversations, use the other user's info if no name
      if (conversation.type === 'DIRECT' && !conversation.name) {
        const otherUser = conversation.members.find((m) => m.userId !== userId)?.user
        if (otherUser) {
          conversation.name = otherUser.name
          conversation.avatar = otherUser.avatar
        }
      }

      return {
        ...conversation,
        unreadCount,
        currentUserRole,
        isCurrentUserAdmin,
        memberCount,
      }
    })

    return {
      ...result,
      data: enrichedConversations,
    }
  }

  async getConversationById(conversationId: string, userId: number) {
    const conversation = await this.conversationRepo.findById(conversationId, userId)

    if (!conversation) {
      throw new NotFoundException('Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập')
    }

    const currentUserMember = conversation.members.find((m) => m.userId === userId)
    const unreadCount = currentUserMember?.unreadCount || 0
    const currentUserRole = currentUserMember?.role || null
    const isCurrentUserAdmin = currentUserRole === 'ADMIN'
    const memberCount = conversation.members.length

    // For direct conversations, use the other user's info
    if (conversation.type === 'DIRECT' && !conversation.name) {
      const otherUser = conversation.members.find((m) => m.userId !== userId)?.user
      if (otherUser) {
        conversation.name = otherUser.name
        conversation.avatar = otherUser.avatar
      }
    }

    return {
      ...conversation,
      unreadCount,
      currentUserRole,
      isCurrentUserAdmin,
      memberCount,
    }
  }

  async createDirectConversation(userId: number, recipientId: number) {
    // Validate recipient exists and is active
    const recipient = await this.userRepo.findById(recipientId)
    if (!recipient || recipient.status !== 'ACTIVE') {
      throw new NotFoundException('Người dùng không tồn tại hoặc không hoạt động')
    }

    if (userId === recipientId) {
      throw new BadRequestException('Không thể tạo cuộc trò chuyện với chính mình')
    }

    // Check if direct conversation already exists
    const existingConversation = await this.conversationRepo.findDirectConversation(userId, recipientId)
    if (existingConversation) {
      return this.getConversationById(existingConversation.id, userId)
    }

    // Create new direct conversation
    const conversation = await this.conversationRepo.create({
      type: 'DIRECT',
      memberIds: [userId, recipientId],
    })

    return this.getConversationById(conversation!.id, userId)
  }

  async createGroupConversation(
    ownerId: number,
    data: {
      name: string
      description?: string
      memberIds: number[]
      avatar?: string
    },
  ) {
    // Validate group name
    if (!data.name.trim()) {
      throw new BadRequestException('Tên nhóm không được để trống')
    }

    // Validate all members exist and are active
    const allMemberIds = [ownerId, ...data.memberIds]
    const uniqueMemberIds = Array.from(new Set(allMemberIds))

    const members = await this.userRepo.findByIds(uniqueMemberIds)
    const activeMembers = members.filter((m) => m.status === 'ACTIVE')

    if (activeMembers.length !== uniqueMemberIds.length) {
      throw new BadRequestException('Một số thành viên không tồn tại hoặc không hoạt động')
    }

    if (uniqueMemberIds.length < 3) {
      throw new BadRequestException('Nhóm phải có ít nhất 3 thành viên')
    }

    if (uniqueMemberIds.length > 100) {
      throw new BadRequestException('Nhóm không thể có quá 100 thành viên')
    }

    // Create group conversation
    const conversation = await this.conversationRepo.create({
      type: 'GROUP',
      name: data.name.trim(),
      description: data.description?.trim(),
      avatar: data.avatar,
      ownerId,
      memberIds: uniqueMemberIds,
    })

    // Create system message about group creation
    await this.messageRepo.create({
      conversationId: conversation!.id,
      fromUserId: ownerId,
      content: `${members.find((m) => m.id === ownerId)?.name} đã tạo nhóm`,
      type: 'SYSTEM',
    })

    return this.getConversationById(conversation!.id, ownerId)
  }

  async updateConversation(
    conversationId: string,
    userId: number,
    data: {
      name?: string
      description?: string
      avatar?: string
    },
  ) {
    const conversation = await this.conversationRepo.findById(conversationId, userId)
    if (!conversation) {
      throw new NotFoundException('Cuộc trò chuyện không tồn tại')
    }

    if (conversation.type === 'DIRECT') {
      throw new BadRequestException('Không thể cập nhật thông tin cuộc trò chuyện 1-1')
    }

    // Verify user has admin rights
    const userRole = await this.conversationRepo.getUserRole(conversationId, userId)
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể cập nhật thông tin nhóm')
    }

    // Validate name if provided
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException('Tên nhóm không được để trống')
    }

    const updateData: Partial<{ name: string; description: string | null; avatar: string; ownerId: number }> = {}
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.avatar !== undefined) updateData.avatar = data.avatar

    const updatedConversation = await this.conversationRepo.update(conversationId, updateData)

    // Create system message about updates
    const changes: string[] = []
    if (data.name) changes.push(`tên nhóm thành "${data.name}"`)
    if (data.description !== undefined) changes.push('mô tả nhóm')
    if (data.avatar !== undefined) changes.push('ảnh đại diện nhóm')

    if (changes.length > 0) {
      const user = await this.userRepo.findById(userId)
      await this.messageRepo.create({
        conversationId,
        fromUserId: userId,
        content: `${user?.name} đã cập nhật ${changes.join(', ')}`,
        type: 'SYSTEM',
      })
    }

    return this.getConversationById(conversationId, userId)
  }

  async archiveConversation(conversationId: string, userId: number) {
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền thực hiện hành động này')
    }

    await this.conversationRepo.archive(conversationId, true)
    return { message: 'Đã lưu trữ cuộc trò chuyện' }
  }

  async unarchiveConversation(conversationId: string, userId: number) {
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền thực hiện hành động này')
    }

    await this.conversationRepo.archive(conversationId, false)
    return { message: 'Đã khôi phục cuộc trò chuyện' }
  }

  async leaveConversation(conversationId: string, userId: number) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) {
      throw new NotFoundException('Cuộc trò chuyện không tồn tại')
    }

    const userRole = await this.conversationRepo.getUserRole(conversationId, userId)
    if (!userRole) {
      throw new NotFoundException('Bạn không phải thành viên của cuộc trò chuyện này')
    }

    // For direct conversations, just mark as inactive
    if (conversation.type === 'DIRECT') {
      await this.conversationRepo.removeMember(conversationId, userId)
      return { message: 'Đã rời khỏi cuộc trò chuyện' }
    }

    // For group conversations
    const activeMembers = conversation.members.filter((m) => m.isActive && m.userId !== userId)

    // If user is owner and there are other members
    if (conversation.ownerId === userId && activeMembers.length > 0) {
      // Transfer ownership to another admin or first member
      const newOwner = activeMembers.find((m) => m.role === 'ADMIN') || activeMembers[0]
      await this.conversationRepo.update(conversationId, { ownerId: newOwner.userId })

      if (newOwner.role !== 'ADMIN') {
        await this.conversationRepo.updateMemberRole(conversationId, newOwner.userId, 'ADMIN')
      }

      // Create system message about ownership transfer
      await this.messageRepo.create({
        conversationId,
        fromUserId: userId,
        content: `${newOwner.user.name} đã trở thành quản trị viên nhóm`,
        type: 'SYSTEM',
      })
    }

    // If last member leaving, archive conversation
    if (activeMembers.length === 0) {
      await this.conversationRepo.archive(conversationId, true)
    }

    // Remove user from conversation
    await this.conversationRepo.removeMember(conversationId, userId)

    // Create system message about user leaving
    const user = await this.userRepo.findById(userId)
    await this.messageRepo.create({
      conversationId,
      fromUserId: userId,
      content: `${user?.name} đã rời khỏi nhóm`,
      type: 'SYSTEM',
    })

    return { message: 'Đã rời khỏi nhóm' }
  }

  // ===== MEMBER MANAGEMENT =====

  async addMembers(conversationId: string, userId: number, memberIds: number[]) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) {
      throw new NotFoundException('Cuộc trò chuyện không tồn tại')
    }

    if (conversation.type === 'DIRECT') {
      throw new BadRequestException('Không thể thêm thành viên vào cuộc trò chuyện 1-1')
    }

    // Verify user has admin/moderator rights
    const userRole = await this.conversationRepo.getUserRole(conversationId, userId)
    if (!['ADMIN', 'MODERATOR'].includes(userRole || '')) {
      throw new ForbiddenException('Chỉ quản trị viên và điều hành viên mới có thể thêm thành viên')
    }

    // Validate new members exist and are active
    const newMembers = await this.userRepo.findByIds(memberIds)
    const activeNewMembers = newMembers.filter((m) => m.status === 'ACTIVE')

    if (activeNewMembers.length !== memberIds.length) {
      throw new BadRequestException('Một số người dùng không tồn tại hoặc không hoạt động')
    }

    // Check group size limit
    const currentMemberCount = conversation.members.filter((m) => m.isActive).length
    if (currentMemberCount + activeNewMembers.length > 100) {
      throw new BadRequestException('Nhóm không thể có quá 100 thành viên')
    }

    // Add members
    const addedMembers: Array<{
      user: { id: number; name: string; avatar: string | null; email: string; status: UserStatus }
      id: string
      role: ConversationRole
      joinedAt: Date
      isActive: boolean
      userId: number
      conversationId: string
      mutedUntil: Date | null
      unreadCount: number
      lastReadAt: Date | null
    }> = []
    for (const memberId of memberIds) {
      const isAlreadyMember = await this.conversationRepo.isUserMember(conversationId, memberId)
      if (!isAlreadyMember) {
        const member = await this.conversationRepo.addMember(conversationId, memberId)
        addedMembers.push(member)
      }
    }

    // Create system message about new members
    if (addedMembers.length > 0) {
      const user = await this.userRepo.findById(userId)
      const memberNames = addedMembers.map((m) => m.user.name).join(', ')
      await this.messageRepo.create({
        conversationId,
        fromUserId: userId,
        content: `${user?.name} đã thêm ${memberNames} vào nhóm`,
        type: 'SYSTEM',
      })
    }

    return this.getConversationById(conversationId, userId)
  }

  async removeMember(conversationId: string, userId: number, memberId: number) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) {
      throw new NotFoundException('Cuộc trò chuyện không tồn tại')
    }

    if (conversation.type === 'DIRECT') {
      throw new BadRequestException('Không thể xóa thành viên khỏi cuộc trò chuyện 1-1')
    }

    // Verify user has admin rights
    const userRole = await this.conversationRepo.getUserRole(conversationId, userId)
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể xóa thành viên')
    }

    // Cannot remove conversation owner
    if (conversation.ownerId === memberId) {
      throw new BadRequestException('Không thể xóa chủ nhóm')
    }

    // Cannot remove self
    if (userId === memberId) {
      throw new BadRequestException('Sử dụng chức năng rời nhóm thay vì xóa chính mình')
    }

    const member = conversation.members.find((m) => m.userId === memberId && m.isActive)
    if (!member) {
      throw new NotFoundException('Thành viên không tồn tại trong nhóm')
    }

    await this.conversationRepo.removeMember(conversationId, memberId)

    // Create system message about member removal
    const [user, removedUser] = await Promise.all([this.userRepo.findById(userId), this.userRepo.findById(memberId)])

    await this.messageRepo.create({
      conversationId,
      fromUserId: userId,
      content: `${user?.name} đã xóa ${removedUser?.name} khỏi nhóm`,
      type: 'SYSTEM',
    })

    return { message: 'Đã xóa thành viên khỏi nhóm' }
  }

  async updateMemberRole(
    conversationId: string,
    userId: number,
    memberId: number,
    role: 'ADMIN' | 'MODERATOR' | 'MEMBER',
  ) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) {
      throw new NotFoundException('Cuộc trò chuyện không tồn tại')
    }

    if (conversation.type === 'DIRECT') {
      throw new BadRequestException('Không thể thay đổi vai trò trong cuộc trò chuyện 1-1')
    }

    // Verify user has admin rights
    const userRole = await this.conversationRepo.getUserRole(conversationId, userId)
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể thay đổi vai trò thành viên')
    }

    // Cannot change owner role
    if (conversation.ownerId === memberId) {
      throw new BadRequestException('Không thể thay đổi vai trò của chủ nhóm')
    }

    // Cannot change own role
    if (userId === memberId) {
      throw new BadRequestException('Không thể thay đổi vai trò của chính mình')
    }

    const member = conversation.members.find((m) => m.userId === memberId && m.isActive)
    if (!member) {
      throw new NotFoundException('Thành viên không tồn tại trong nhóm')
    }

    await this.conversationRepo.updateMemberRole(conversationId, memberId, role)

    // Create system message about role change
    const [user, targetUser] = await Promise.all([this.userRepo.findById(userId), this.userRepo.findById(memberId)])

    const roleNames = {
      ADMIN: 'quản trị viên',
      MODERATOR: 'điều hành viên',
      MEMBER: 'thành viên',
    }

    await this.messageRepo.create({
      conversationId,
      fromUserId: userId,
      content: `${user?.name} đã đặt ${targetUser?.name} làm ${roleNames[role]}`,
      type: 'SYSTEM',
    })

    return { message: 'Đã cập nhật vai trò thành viên' }
  }

  async muteConversation(conversationId: string, userId: number, mutedUntil?: Date) {
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền thực hiện hành động này')
    }

    await this.conversationRepo.muteMember(conversationId, userId, mutedUntil)
    return { message: 'Đã tắt thông báo cuộc trò chuyện' }
  }

  async unmuteConversation(conversationId: string, userId: number) {
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền thực hiện hành động này')
    }

    await this.conversationRepo.unmuteMember(conversationId, userId)
    return { message: 'Đã bật thông báo cuộc trò chuyện' }
  }

  // ===== UTILITY METHODS =====

  async getConversationMembers(conversationId: string, userId: number) {
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách thành viên')
    }

    return this.conversationRepo.getConversationMembers(conversationId)
  }

  async getConversationStats(userId: number) {
    return this.conversationRepo.getConversationStats(userId)
  }

  async isUserInConversation(conversationId: string, userId: number): Promise<boolean> {
    return this.conversationRepo.isUserMember(conversationId, userId)
  }

  async getUserRoleInConversation(conversationId: string, userId: number) {
    return this.conversationRepo.getUserRole(conversationId, userId)
  }
}
