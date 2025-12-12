import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { AcademicStructureService } from '../services/academic-structure.service';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  CreateTermDto,
  UpdateTermDto,
} from '../dto';
import { RequestUser } from '../../auth/types/request-user';

@ApiTags('academic-structure')
@Controller('academic-years')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AcademicYearController {
  constructor(private readonly academicService: AcademicStructureService) {}

  @Post()
  @RequirePermissions(['schedules.create'])
  @ApiOperation({ summary: 'Create academic year' })
  async createYear(
    @Body() dto: CreateAcademicYearDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.createAcademicYear(user.tenantId, user.userId, dto);
  }

  @Get()
  @RequirePermissions(['schedules.view'])
  @ApiOperation({ summary: 'List academic years' })
  async listYears(
    @Query('status') status: string | undefined,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.listAcademicYears(user.tenantId, status);
  }

  @Get(':id')
  @RequirePermissions(['schedules.view'])
  @ApiOperation({ summary: 'Get academic year by ID' })
  async getYear(@Param('id') id: string, @Request() req: { user?: RequestUser }) {
    const user = req.user!;
    return this.academicService.getAcademicYear(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermissions(['schedules.edit'])
  @ApiOperation({ summary: 'Update academic year' })
  async updateYear(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.updateAcademicYear(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(['schedules.edit'])
  @ApiOperation({ summary: 'Delete academic year' })
  async deleteYear(
    @Param('id') id: string,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.deleteAcademicYear(user.tenantId, id);
  }

  // ----- Terms -----
  @Post(':id/terms')
  @RequirePermissions(['schedules.create'])
  @ApiOperation({ summary: 'Create term for academic year' })
  async createTerm(
    @Param('id') academicYearId: string,
    @Body() dto: CreateTermDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.createTerm(
      user.tenantId,
      user.userId,
      academicYearId,
      dto,
    );
  }

  @Get(':id/terms')
  @RequirePermissions(['schedules.view'])
  @ApiOperation({ summary: 'List terms for academic year' })
  async listTerms(
    @Param('id') academicYearId: string,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.listTerms(user.tenantId, academicYearId);
  }

  @Get('/terms/:termId')
  @RequirePermissions(['schedules.view'])
  @ApiOperation({ summary: 'Get term by ID' })
  async getTerm(
    @Param('termId') termId: string,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.getTerm(user.tenantId, termId);
  }

  @Put('/terms/:termId')
  @RequirePermissions(['schedules.edit'])
  @ApiOperation({ summary: 'Update term' })
  async updateTerm(
    @Param('termId') termId: string,
    @Body() dto: UpdateTermDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.updateTerm(user.tenantId, user.userId, termId, dto);
  }

  @Delete('/terms/:termId')
  @RequirePermissions(['schedules.edit'])
  @ApiOperation({ summary: 'Delete term' })
  async deleteTerm(
    @Param('termId') termId: string,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.academicService.deleteTerm(user.tenantId, termId);
  }
}

