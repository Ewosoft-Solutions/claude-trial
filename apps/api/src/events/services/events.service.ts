import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  AddAttendeeDto,
  CreateEventDto,
  ListEventsDto,
  UpdateAttendeeDto,
  UpdateEventDto,
} from '../dto/events.dto';

const EVENT_ROSTER_SELECT = {
  id: true,
  title: true,
  startDate: true,
  capacity: true,
  registeredCount: true,
  status: true,
} as const;

/** Attendee statuses that count against an event's registered total. */
const REGISTERED_STATUSES = ['registered', 'attended'];

@Injectable()
export class EventsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async listEvents(tenantId: string, query: ListEventsDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.eventType) where['eventType'] = query.eventType;
    if (query.query) {
      where['title'] = { contains: query.query, mode: 'insensitive' };
    }

    return this.client.schoolEvent.findMany({
      where,
      orderBy: [{ startDate: 'asc' }],
    });
  }

  async eventsSummary(tenantId: string) {
    const events = await this.client.schoolEvent.findMany({
      where: { tenantId },
      select: { status: true, eventType: true },
    });

    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    for (const e of events) {
      statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
      const type = e.eventType ?? 'other';
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    }

    return { totalEvents: events.length, statusCounts, typeCounts };
  }

  async createEvent(tenantId: string, dto: CreateEventDto, userId: string) {
    return this.client.schoolEvent.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description ?? null,
        eventType: dto.eventType ?? null,
        location: dto.location ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        capacity: dto.capacity ?? null,
        status: 'scheduled',
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateEvent(tenantId: string, id: string, dto: UpdateEventDto, userId: string) {
    const event = await this.client.schoolEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.client.schoolEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.registeredCount !== undefined && { registeredCount: dto.registeredCount }),
        updatedBy: userId,
      },
    });
  }

  // ---- Roster (per-attendee) ------------------------------------------

  /** An event with its attendee roster (registered/attended/waitlist/cancelled). */
  async listRoster(tenantId: string, eventId: string) {
    const event = await this.client.schoolEvent.findFirst({
      where: { id: eventId, tenantId },
      select: EVENT_ROSTER_SELECT,
    });
    if (!event) throw new NotFoundException('Event not found');

    const attendees = await this.client.eventAttendee.findMany({
      where: { tenantId, eventId },
      orderBy: [{ attendeeName: 'asc' }],
    });
    return { event, attendees };
  }

  async addAttendee(
    tenantId: string,
    eventId: string,
    dto: AddAttendeeDto,
    userId: string,
  ) {
    const event = await this.client.schoolEvent.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const attendee = await this.client.eventAttendee.create({
      data: {
        tenantId,
        eventId,
        attendeeName: dto.attendeeName,
        attendeeType: dto.attendeeType,
        email: dto.email ?? null,
        status: dto.status ?? 'registered',
        createdBy: userId,
        updatedBy: userId,
      },
    });
    await this.syncRegisteredCount(tenantId, eventId);
    return attendee;
  }

  async updateAttendee(
    tenantId: string,
    eventId: string,
    attendeeId: string,
    dto: UpdateAttendeeDto,
    userId: string,
  ) {
    const attendee = await this.client.eventAttendee.findFirst({
      where: { id: attendeeId, tenantId, eventId },
    });
    if (!attendee) throw new NotFoundException('Attendee not found');

    const updated = await this.client.eventAttendee.update({
      where: { id: attendeeId },
      data: {
        ...(dto.attendeeName !== undefined && { attendeeName: dto.attendeeName }),
        ...(dto.attendeeType !== undefined && { attendeeType: dto.attendeeType }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.status !== undefined && { status: dto.status }),
        updatedBy: userId,
      },
    });
    await this.syncRegisteredCount(tenantId, eventId);
    return updated;
  }

  /** Keep SchoolEvent.registeredCount consistent with live roster rows. */
  private async syncRegisteredCount(tenantId: string, eventId: string) {
    const count = await this.client.eventAttendee.count({
      where: { tenantId, eventId, status: { in: REGISTERED_STATUSES } },
    });
    await this.client.schoolEvent.update({
      where: { id: eventId },
      data: { registeredCount: count },
    });
  }
}
