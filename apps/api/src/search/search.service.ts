import { Injectable } from '@nestjs/common';
import type { Prisma } from '@workspace/database';

import { TenantDbService } from '../common/database/tenant-db.service';
import { AcademicsAccessService } from '../common/academics/academics-access.service';
import type { UserPermissionContext } from '../auth/services/permission.service';
import type { SearchQueryDto } from './dto';

export type SearchResultKind = 'student' | 'class' | 'person';

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  description: string;
  meta?: string;
  href: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  );
}

@Injectable()
export class SearchService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly academicsAccess: AcademicsAccessService,
  ) {}

  async search(
    tenantId: string,
    userContext: UserPermissionContext,
    query: SearchQueryDto,
  ): Promise<SearchResponse> {
    const has = (permission: string) =>
      userContext.permissions.get(permission)?.granted === true;
    const canSearchStudents = has('students.view');
    const canSearchClasses = has('schedules.view');
    const canSearchPeople = has('users.view');
    const canViewAllAcademics = has('classes.teachers.assign');

    const taughtClassIds =
      (canSearchStudents || canSearchClasses) && !canViewAllAcademics
        ? await this.academicsAccess.getTaughtClassIds(
            tenantId,
            userContext.profileId,
          )
        : undefined;

    const [students, classes, people] = await Promise.all([
      canSearchStudents
        ? this.searchStudents(tenantId, query.q, query.limit, taughtClassIds)
        : Promise.resolve([]),
      canSearchClasses
        ? this.searchClasses(tenantId, query.q, query.limit, taughtClassIds)
        : Promise.resolve([]),
      canSearchPeople
        ? this.searchPeople(tenantId, query.q, query.limit)
        : Promise.resolve([]),
    ]);

    return {
      query: query.q,
      results: [...students, ...classes, ...people],
    };
  }

  private async searchStudents(
    tenantId: string,
    query: string,
    limit: number,
    classIds?: string[],
  ): Promise<SearchResult[]> {
    const where: Prisma.StudentWhereInput = {
      tenantId,
      AND: [
        {
          OR: [
            { studentNumber: { contains: query, mode: 'insensitive' } },
            { admissionNumber: { contains: query, mode: 'insensitive' } },
            {
              userTenant: {
                user: {
                  OR: [
                    { email: { contains: query, mode: 'insensitive' } },
                    { firstName: { contains: query, mode: 'insensitive' } },
                    { lastName: { contains: query, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        },
        ...(classIds
          ? [
              {
                enrollments: {
                  some: { classId: { in: classIds }, status: 'active' },
                },
              } satisfies Prisma.StudentWhereInput,
            ]
          : []),
      ],
    };

    const rows = await this.tenantDb.client.student.findMany({
      where,
      take: limit,
      orderBy: [{ enrollmentStatus: 'asc' }, { studentNumber: 'asc' }],
      select: {
        id: true,
        studentNumber: true,
        gradeLevel: true,
        enrollmentStatus: true,
        userTenant: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return rows.map((student) => ({
      id: student.id,
      kind: 'student' as const,
      title: displayName(student.userTenant.user),
      description: student.studentNumber,
      meta: [
        student.gradeLevel && `Grade ${student.gradeLevel}`,
        student.enrollmentStatus,
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/students/directory?search=${encodeURIComponent(student.studentNumber)}`,
    }));
  }

  private async searchClasses(
    tenantId: string,
    query: string,
    limit: number,
    classIds?: string[],
  ): Promise<SearchResult[]> {
    const rows = await this.tenantDb.client.class.findMany({
      where: {
        tenantId,
        ...(classIds ? { id: { in: classIds } } : {}),
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { section: { contains: query, mode: 'insensitive' } },
          { room: { contains: query, mode: 'insensitive' } },
          { course: { name: { contains: query, mode: 'insensitive' } } },
          { course: { code: { contains: query, mode: 'insensitive' } } },
        ],
      },
      take: limit,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        section: true,
        room: true,
        status: true,
        course: { select: { name: true, code: true } },
        term: { select: { name: true } },
      },
    });

    return rows.map((item) => {
      const generatedTitle = [item.course.name, item.section]
        .filter(Boolean)
        .join(' ');
      return {
        id: item.id,
        kind: 'class' as const,
        title: item.name || generatedTitle || item.course.code,
        description: [item.course.code, item.term.name, item.room]
          .filter(Boolean)
          .join(' · '),
        meta: item.status,
        href: `/classes/timetable?class=${encodeURIComponent(item.id)}`,
      };
    });
  }

  private async searchPeople(
    tenantId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const rows = await this.tenantDb.client.userTenant.findMany({
      where: {
        tenantId,
        user: {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      take: limit,
      orderBy: { addedAt: 'desc' },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        userTenantRole: {
          select: { role: { select: { name: true } } },
        },
      },
    });

    return rows.map((profile) => ({
      id: profile.id,
      kind: 'person' as const,
      title: displayName(profile.user),
      description: profile.user.email,
      meta: [profile.userTenantRole?.role.name, profile.status]
        .filter(Boolean)
        .join(' · '),
      href: `/settings/users#user-${encodeURIComponent(profile.id)}`,
    }));
  }
}
