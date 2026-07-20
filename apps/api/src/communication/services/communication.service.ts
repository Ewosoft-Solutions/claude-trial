import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  ListAnnouncementsDto,
  CreateMessageDto,
  MarkMessageReadDto,
  ListMessagesDto,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TARGET_TYPES,
  MESSAGE_CONTENT_TYPES,
  MESSAGE_STATUSES,
} from '../dto';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  /**
   * The active DB client. Inside an RLS scope (a `@TenantScoped` route) this is
   * the `app_runtime` transaction client so Postgres RLS enforces tenant
   * isolation; otherwise it falls back to the privileged client (unmigrated
   * routes behave exactly as before). See ADR-004.
   */
  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  private assertValue(value: string, allowed: readonly string[], message: string) {
    if (!allowed.includes(value)) {
      throw new BadRequestException(message);
    }
  }

  // ---------- Announcements ----------
  async createAnnouncement(tenantId: string, userTenantId: string, dto: CreateAnnouncementDto) {
    if (dto.priority) {
      this.assertValue(dto.priority, ANNOUNCEMENT_PRIORITIES, 'Invalid priority');
    }
    this.assertValue(dto.status ?? 'draft', ANNOUNCEMENT_STATUSES, 'Invalid status');
    this.assertValue(dto.targetType, ANNOUNCEMENT_TARGET_TYPES, 'Invalid target type');

    return this.client.announcement.create({
      data: {
        tenantId,
        targetType: dto.targetType,
        targetIds: dto.targetIds ?? [],
        title: dto.title,
        content: dto.content,
        summary: dto.summary,
        priority: dto.priority ?? 'normal',
        status: dto.status ?? 'draft',
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        attachments: dto.attachments ?? [],
        metadata: dto.metadata ?? undefined,
        createdBy: userTenantId,
      },
    });
  }

  async listAnnouncements(tenantId: string, filters: ListAnnouncementsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.status) {
      this.assertValue(filters.status, ANNOUNCEMENT_STATUSES, 'Invalid status');
      where.status = filters.status;
    }
    if (filters.priority) {
      this.assertValue(filters.priority, ANNOUNCEMENT_PRIORITIES, 'Invalid priority');
      where.priority = filters.priority;
    }
    if (filters.targetType) {
      this.assertValue(filters.targetType, ANNOUNCEMENT_TARGET_TYPES, 'Invalid target type');
      where.targetType = filters.targetType;
    }

    const [data, total] = await Promise.all([
      this.client.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.client.announcement.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getAnnouncement(tenantId: string, id: string) {
    const ann = await this.client.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!ann) throw new NotFoundException('Announcement not found');
    return ann;
  }

  async updateAnnouncement(
    tenantId: string,
    userTenantId: string,
    id: string,
    dto: UpdateAnnouncementDto,
  ) {
    const ann = await this.client.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!ann) throw new NotFoundException('Announcement not found');

    if (dto.status) {
      this.assertValue(dto.status, ANNOUNCEMENT_STATUSES, 'Invalid status');
    }
    if (dto.priority) {
      this.assertValue(dto.priority, ANNOUNCEMENT_PRIORITIES, 'Invalid priority');
    }
    if (dto.targetType) {
      this.assertValue(dto.targetType, ANNOUNCEMENT_TARGET_TYPES, 'Invalid target type');
    }

    return this.client.announcement.update({
      where: { id },
      data: {
        targetType: dto.targetType ?? undefined,
        targetIds: dto.targetIds ?? undefined,
        title: dto.title ?? undefined,
        content: dto.content ?? undefined,
        summary: dto.summary ?? undefined,
        priority: dto.priority ?? undefined,
        status: dto.status ?? undefined,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        attachments: dto.attachments ?? undefined,
        metadata: dto.metadata ?? undefined,
        updatedBy: userTenantId,
      },
    });
  }

  async publishAnnouncement(tenantId: string, userTenantId: string, id: string) {
    const ann = await this.client.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!ann) throw new NotFoundException('Announcement not found');

    return this.client.announcement.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        updatedBy: userTenantId,
      },
    });
  }

  async archiveAnnouncement(tenantId: string, userTenantId: string, id: string) {
    const ann = await this.client.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!ann) throw new NotFoundException('Announcement not found');

    return this.client.announcement.update({
      where: { id },
      data: {
        status: 'archived',
        updatedBy: userTenantId,
      },
    });
  }

  async deleteAnnouncement(tenantId: string, id: string) {
    const ann = await this.client.announcement.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!ann) throw new NotFoundException('Announcement not found');

    await this.client.announcement.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Messages ----------
  async sendMessage(
    tenantId: string,
    senderProfileId: string,
    dto: CreateMessageDto,
  ) {
    if (dto.contentType) {
      this.assertValue(dto.contentType, MESSAGE_CONTENT_TYPES, 'Invalid content type');
    }
    if (!dto.recipientIds || dto.recipientIds.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    // Ensure sender profile exists in tenant
    const senderProfile = await this.client.userTenant.findFirst({
      where: { id: senderProfileId, tenantId },
      select: { id: true },
    });
    if (!senderProfile) {
      throw new BadRequestException('Sender profile not found for tenant');
    }

    // Optionally, validate recipients belong to tenant
    const recipientCount = await this.client.userTenant.count({
      where: { id: { in: dto.recipientIds }, tenantId },
    });
    if (recipientCount !== dto.recipientIds.length) {
      throw new BadRequestException('One or more recipients not found in tenant');
    }

    return this.client.message.create({
      data: {
        tenantId,
        threadId: dto.threadId ?? null,
        senderId: senderProfileId,
        recipientIds: dto.recipientIds,
        subject: dto.subject,
        content: dto.content,
        contentType: dto.contentType ?? 'text',
        status: 'sent',
        attachments: dto.attachments ?? [],
        metadata: dto.metadata ?? undefined,
        sentAt: new Date(),
      },
    });
  }

  async listInbox(tenantId: string, profileId: string, filters: ListMessagesDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      recipientIds: { has: profileId },
    };
    if (filters.status) {
      this.assertValue(filters.status, MESSAGE_STATUSES, 'Invalid status');
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.client.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.client.message.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async listSent(tenantId: string, profileId: string, filters: ListMessagesDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      senderId: profileId,
    };
    if (filters.status) {
      this.assertValue(filters.status, MESSAGE_STATUSES, 'Invalid status');
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.client.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.client.message.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getThread(tenantId: string, profileId: string, messageId: string) {
    const msg = await this.client.message.findFirst({
      where: {
        id: messageId,
        tenantId,
        OR: [{ senderId: profileId }, { recipientIds: { has: profileId } }],
      },
      include: {
        replies: true,
      },
    });
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }

  async markRead(tenantId: string, profileId: string, dto: MarkMessageReadDto) {
    const msg = await this.client.message.findFirst({
      where: {
        id: dto.messageId,
        tenantId,
        OR: [{ senderId: profileId }, { recipientIds: { has: profileId } }],
      },
      select: { id: true, status: true },
    });
    if (!msg) throw new NotFoundException('Message not found');

    // Create read receipt if not exists
    await this.client.messageReadReceipt.upsert({
      where: {
        messageId_readerId: {
          messageId: dto.messageId,
          readerId: profileId,
        },
      },
      update: { readAt: new Date() },
      create: {
        messageId: dto.messageId,
        readerId: profileId,
        readAt: new Date(),
      },
    });

    // Update message status to read if all recipients have read
    const recipientCount = await this.client.message.findUnique({
      where: { id: dto.messageId },
      select: { recipientIds: true },
    });
    const receipts = await this.client.messageReadReceipt.count({
      where: { messageId: dto.messageId },
    });
    const allRead =
      recipientCount?.recipientIds &&
      recipientCount.recipientIds.length > 0 &&
      receipts >= recipientCount.recipientIds.length;

    if (allRead) {
      await this.client.message.update({
        where: { id: dto.messageId },
        data: { status: 'read' },
      });
    }

    return { success: true };
  }
}

