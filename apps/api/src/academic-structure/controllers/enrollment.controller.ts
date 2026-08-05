import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from 'src/auth';
import { EnrollmentService } from '../services/enrollment.service';
import type { StructureActor } from '../services/academic-structure-model.service';
import {
  CreateAcademicProfileDto,
  UpdateAcademicProfileDto,
  EnrollSectionDto,
  UpdateSectionEnrollmentDto,
  RegisterCourseDto,
  UpdateCourseRegistrationDto,
  ElectSubjectDto,
  UpdateElectionDto,
  AssignTeacherDto,
  UpdateOfferingTeacherDto,
  ListSectionEnrollmentsDto,
  ListOfferingTeachersDto,
} from '../dto';

/**
 * WB2-2 · Enrollment / registration / electives / teacher assignment over the
 * WB2-1 structure. Reads gated `academics.enrollment.view`; mutations
 * `academics.enrollment.manage` and campus-scoped through the WB1-6
 * `AccessScopeService` in the service. All routes authenticated + RLS-scoped.
 */
@ApiTags('Academic Enrollment')
@Controller('academics/enrollment')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  private ctx(req: AuthenticatedRequest): {
    tenantId: string;
    actor: StructureActor;
  } {
    if (!req.user) throw new ForbiddenException('User context not found');
    return {
      tenantId: req.user.tenantId,
      actor: {
        userId: req.user.userId,
        grantScope: req.userContext?.grantScope ?? null,
      },
    };
  }

  // ---- academic profiles ----
  @Get('profiles')
  @RequirePermissions(['academics.enrollment.view'])
  @ApiOperation({ summary: 'List academic profiles' })
  listProfiles(@Request() req: AuthenticatedRequest) {
    return this.enrollment.listProfiles(this.ctx(req).tenantId);
  }

  @Get('profiles/resolve')
  @RequirePermissions(['academics.enrollment.view'])
  @ApiOperation({
    summary: 'The active enrollment model (profile or schoolType)',
  })
  resolveModel(
    @Query('campusId') campusId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollment.resolveEnrollmentModel(
      this.ctx(req).tenantId,
      campusId,
    );
  }

  @Post('profiles')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({ summary: 'Create an academic profile' })
  createProfile(
    @Body() dto: CreateAcademicProfileDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.createProfile(tenantId, actor.userId, dto);
  }

  @Patch('profiles/:id')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({ summary: 'Update an academic profile' })
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicProfileDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.updateProfile(tenantId, actor.userId, id, dto);
  }

  // ---- section enrollment (K-12) ----
  @Get('sections')
  @RequirePermissions(['academics.enrollment.view'])
  @ApiOperation({ summary: 'List section enrollments' })
  listSections(
    @Query() query: ListSectionEnrollmentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollment.listSectionEnrollments(
      this.ctx(req).tenantId,
      query,
    );
  }

  @Post('sections')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({ summary: 'Enroll a student into a class section (K-12)' })
  enrollSection(
    @Body() dto: EnrollSectionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.enrollSection(tenantId, actor, dto);
  }

  @Patch('sections/:id')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({ summary: 'Update a section enrollment (transfer/withdraw)' })
  updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateSectionEnrollmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.updateSectionEnrollment(tenantId, actor, id, dto);
  }

  // ---- course registration (tertiary) ----
  @Post('courses')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({
    summary: 'Register a student for a subject offering (tertiary)',
  })
  registerCourse(
    @Body() dto: RegisterCourseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.registerCourse(tenantId, actor, dto);
  }

  @Patch('courses/:id')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({ summary: 'Update a course registration' })
  updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseRegistrationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.updateCourseRegistration(tenantId, actor, id, dto);
  }

  // ---- electives ----
  @Post('electives')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({
    summary: 'Elect an elective subject offering (references an offering)',
  })
  elect(@Body() dto: ElectSubjectDto, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.electSubject(tenantId, actor, dto);
  }

  @Patch('electives/:id')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({ summary: 'Update an elective election' })
  updateElection(
    @Param('id') id: string,
    @Body() dto: UpdateElectionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.updateElection(tenantId, actor, id, dto);
  }

  // ---- teacher assignment ----
  @Get('teachers')
  @RequirePermissions(['academics.enrollment.view'])
  @ApiOperation({ summary: 'List offering-teacher assignments' })
  listTeachers(
    @Query() query: ListOfferingTeachersDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollment.listOfferingTeachers(this.ctx(req).tenantId, query);
  }

  @Post('teachers')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({
    summary: 'Assign a teacher to a subject offering (not a label)',
  })
  assignTeacher(
    @Body() dto: AssignTeacherDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.assignTeacher(tenantId, actor, dto);
  }

  @Patch('teachers/:id')
  @RequirePermissions(['academics.enrollment.manage'])
  @ApiOperation({ summary: 'Update / unassign a teacher assignment' })
  updateTeacher(
    @Param('id') id: string,
    @Body() dto: UpdateOfferingTeacherDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.enrollment.updateOfferingTeacher(tenantId, actor, id, dto);
  }

  // ---- resolver: student → subjects ----
  @Get('students/:studentId/subjects')
  @RequirePermissions(['academics.enrollment.view'])
  @ApiOperation({
    summary: "Resolve a student's subjects (class-vs-course by profile)",
  })
  studentSubjects(
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollment.resolveStudentSubjects(
      this.ctx(req).tenantId,
      studentId,
    );
  }
}
