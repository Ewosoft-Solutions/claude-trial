import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { StudentService } from '../services/student.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  SearchStudentsDto,
  UpdateStudentStatusDto,
  UpdateStudentProfileDto,
  EnrollStudentDto,
  UpdateEnrollmentStatusDto,
} from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.students.name)
@Controller('students')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  /**
   * Create student (13.1)
   */
  @Post()
  @RequirePermissions(['students.create'])
  @ApiOperation({ summary: 'Create a student' })
  async createStudent(
    @Body() dto: CreateStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.create(user!.tenantId, user!.userId, dto);
  }

  /**
   * List/search students (13.3)
   */
  @Get()
  @RequirePermissions(['students.view'])
  @ApiOperation({ summary: 'List students with search and filtering' })
  async listStudents(
    @Query() query: SearchStudentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.list(user!.tenantId, query);
  }

  /**
   * Get student by ID (13.4)
   */
  @Get(':id')
  @RequirePermissions(['students.view.detailed'])
  @ApiOperation({ summary: 'Get detailed student profile' })
  async getStudent(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.getById(user!.tenantId, id);
  }

  /**
   * Update student (basic fields)
   */
  @Put(':id')
  @RequirePermissions(['students.edit'])
  @ApiOperation({ summary: 'Update student basic information' })
  async updateStudent(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.update(user!.tenantId, user!.userId, id, dto);
  }

  /**
   * Update student status (13.7)
   */
  @Patch(':id/status')
  @RequirePermissions(['students.edit'])
  @ApiOperation({ summary: 'Update student status' })
  async updateStudentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStudentStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.updateStatus(
      user!.tenantId,
      user!.userId,
      id,
      dto,
    );
  }

  /**
   * Update student profile sections (13.4, 13.5, 13.6)
   */
  @Patch(':id/profile')
  @RequirePermissions([
    'students.edit.personal_info',
    'students.edit.academic_info',
    'students.edit.medical_info',
  ])
  @ApiOperation({
    summary:
      'Update profile sections (personal, academic, health, guardians, photo, documents)',
  })
  async updateStudentProfile(
    @Param('id') id: string,
    @Body() dto: UpdateStudentProfileDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.updateProfile(
      user!.tenantId,
      user!.userId,
      id,
      dto,
    );
  }

  /**
   * Delete student (13.1 delete)
   */
  @Delete(':id')
  @RequirePermissions(['students.delete'])
  @ApiOperation({ summary: 'Delete student' })
  async deleteStudent(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.delete(user!.tenantId, id);
  }

  /**
   * Enroll student to class (13.2)
   */
  @Post(':id/enrollments')
  @RequirePermissions(['students.edit.academic_info'])
  @ApiOperation({ summary: 'Enroll student into a class' })
  async enrollStudent(
    @Param('id') id: string,
    @Body() dto: EnrollStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.enrollStudent(
      user!.tenantId,
      user!.userId,
      id,
      dto,
    );
  }

  /**
   * List enrollments for student
   */
  @Get(':id/enrollments')
  @RequirePermissions(['students.view.academic_records'])
  @ApiOperation({ summary: 'List student enrollments' })
  async listEnrollments(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.listEnrollments(user!.tenantId, id);
  }

  /**
   * Update enrollment status (13.2 status changes)
   */
  @Patch(':id/enrollments/:enrollmentId/status')
  @RequirePermissions(['students.edit.academic_info'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update enrollment status' })
  async updateEnrollmentStatus(
    @Param('id') id: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: UpdateEnrollmentStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.studentService.updateEnrollmentStatus(
      user!.tenantId,
      user!.userId,
      id,
      enrollmentId,
      dto,
    );
  }
}
