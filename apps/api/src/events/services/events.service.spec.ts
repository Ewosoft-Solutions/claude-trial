/**
 * EventsService unit tests — the roster methods (slice 3 sub-surface). Prisma
 * is stubbed via a fake client; these prove roster reads, that adding an
 * attendee re-syncs the event's registered count, and the not-found paths.
 */
import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';

function build(options: {
  event?: unknown;
  attendees?: unknown[];
  attendeeFindFirst?: unknown;
  registeredCount?: number;
} = {}) {
  const schoolEvent = {
    findFirst: jest.fn().mockResolvedValue(options.event ?? null),
    update: jest.fn(async ({ data }: any) => data),
  };
  const eventAttendee = {
    findMany: jest.fn().mockResolvedValue(options.attendees ?? []),
    create: jest.fn(async ({ data }: any) => ({ id: 'a1', ...data })),
    findFirst: jest.fn().mockResolvedValue(options.attendeeFindFirst ?? null),
    update: jest.fn(async ({ data }: any) => ({ id: 'a1', ...data })),
    count: jest.fn().mockResolvedValue(options.registeredCount ?? 0),
  };
  const client = { schoolEvent, eventAttendee };
  const db = { client };
  const tenantDb = { isScoped: false, client };
  return { service: new EventsService(db as never, tenantDb as never), schoolEvent, eventAttendee };
}

describe('EventsService roster', () => {
  it('returns the event with its attendees', async () => {
    const { service } = build({
      event: { id: 'e1', title: 'Sports Day', startDate: new Date(), capacity: 100, registeredCount: 2, status: 'scheduled' },
      attendees: [{ id: 'a1', attendeeName: 'Ada' }, { id: 'a2', attendeeName: 'Ben' }],
    });
    const roster = await service.listRoster('t1', 'e1');
    expect(roster.event).toMatchObject({ id: 'e1', title: 'Sports Day' });
    expect(roster.attendees).toHaveLength(2);
  });

  it('404s when the event is not found', async () => {
    const { service } = build({ event: null });
    await expect(service.listRoster('t1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('adds an attendee and re-syncs registeredCount', async () => {
    const { service, schoolEvent, eventAttendee } = build({
      event: { id: 'e1' },
      registeredCount: 3,
    });
    const created = await service.addAttendee(
      't1',
      'e1',
      { attendeeName: 'Ada', attendeeType: 'student' },
      'actor',
    );
    expect(created).toMatchObject({ attendeeName: 'Ada', status: 'registered' });
    expect(eventAttendee.count).toHaveBeenCalledWith({
      where: { tenantId: 't1', eventId: 'e1', status: { in: ['registered', 'attended'] } },
    });
    expect(schoolEvent.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { registeredCount: 3 },
    });
  });

  it('404s when adding to a missing event', async () => {
    const { service } = build({ event: null });
    await expect(
      service.addAttendee('t1', 'missing', { attendeeName: 'A', attendeeType: 'guest' }, 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates an attendee and re-syncs registeredCount', async () => {
    const { service, eventAttendee } = build({
      attendeeFindFirst: { id: 'a1', tenantId: 't1', eventId: 'e1', status: 'registered' },
      registeredCount: 1,
    });
    const updated = await service.updateAttendee(
      't1',
      'e1',
      'a1',
      { status: 'attended' },
      'actor',
    );
    expect(updated).toMatchObject({ status: 'attended' });
    expect(eventAttendee.count).toHaveBeenCalled();
  });
});
