import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { AcademicStructureService } from '../services/academic-structure.service';
import {
  CreateClassDto,
  UpdateClassDto,
  UpdateScheduleDto,
  AssignStudentToClassDto,
  ListClassesDto,
} from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.classes.name)
@Controller('classes')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class ClassController {
  constructor(private readonly academicService: AcademicStructureService) {}

  @Post()
  @RequirePermissions(['schedules.create'])
  @ApiOperation({ summary: 'Create class/section' })
  async createClass(
    @Body() dto: CreateClassDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.createClass(user.tenantId, user.userId, dto);
  }

  @Get()
  @RequirePermissions(['schedules.view'])
  @ApiOperation({ summary: 'List classes with filters' })
  async listClasses(
    @Query() query: ListClassesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.listClasses(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(['schedules.view'])
  @ApiOperation({ summary: 'Get class by ID' })
  async getClass(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.getClass(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermissions(['schedules.edit'])
  @ApiOperation({ summary: 'Update class' })
  async updateClass(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.updateClass(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(['schedules.edit'])
  @ApiOperation({ summary: 'Delete class' })
  async deleteClass(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.deleteClass(user.tenantId, id);
  }

  // Schedule / timetable (14.6, 14.7)
  @Patch(':id/schedule')
  @RequirePermissions(['schedules.edit'])
  @ApiOperation({ summary: 'Update class schedule/timetable' })
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.updateSchedule(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  // Class-student assignment (14.5)
  @Post(':id/students')
  @RequirePermissions(['students.edit.academic_info'])
  @ApiOperation({ summary: 'Assign student to class' })
  async assignStudent(
    @Param('id') id: string,
    @Body() dto: AssignStudentToClassDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.assignStudentToClass(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Get(':id/students')
  @RequirePermissions(['students.view.academic_records'])
  @ApiOperation({ summary: 'List students assigned to class' })
  async listStudents(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.listClassStudents(user.tenantId, id);
  }

  @Delete(':id/students/:studentId')
  @RequirePermissions(['students.edit.academic_info'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove student from class' })
  async removeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.removeStudentFromClass(
      user.tenantId,
      user.userId,
      id,
      studentId,
    );
  }
}
