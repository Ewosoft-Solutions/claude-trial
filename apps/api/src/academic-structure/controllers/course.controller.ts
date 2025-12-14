import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { AcademicStructureService } from '../services/academic-structure.service';
import { CreateCourseDto, UpdateCourseDto } from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags('courses')
@Controller('courses')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class CourseController {
  constructor(private readonly academicService: AcademicStructureService) {}

  @Post()
  @RequirePermissions(['courses.create'])
  @ApiOperation({ summary: 'Create course' })
  async createCourse(
    @Body() dto: CreateCourseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.createCourse(user.tenantId, user.userId, dto);
  }

  @Get()
  @RequirePermissions(['courses.view'])
  @ApiOperation({ summary: 'List courses' })
  async listCourses(
    @Query('search') search: string | undefined,
    @Query('status') status: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user!;
    return this.academicService.listCourses(user.tenantId, search, status);
  }

  @Get(':id')
  @RequirePermissions(['courses.view'])
  @ApiOperation({ summary: 'Get course by ID' })
  async getCourse(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    return this.academicService.getCourse(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermissions(['courses.edit'])
  @ApiOperation({ summary: 'Update course' })
  async updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.updateCourse(user.tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(['courses.delete'])
  @ApiOperation({ summary: 'Delete course' })
  async deleteCourse(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.academicService.deleteCourse(user.tenantId, id);
  }
}

