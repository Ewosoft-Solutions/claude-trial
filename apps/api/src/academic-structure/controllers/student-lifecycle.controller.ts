import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { StudentLifecycleService } from '../services/student-lifecycle.service';
import type { StructureActor } from '../services/academic-structure-model.service';
import {
  RegisterStudentDto,
  TransferStudentDto,
  WithdrawStudentDto,
  GraduateStudentDto,
  ListPlacementHistoryDto,
} from '../dto';

/**
 * WB2-3 · Student lifecycle — registration · transfer · withdrawal · graduation,
 * each a durable, effective-dated event that keeps history. Reads gated
 * `academics.lifecycle.view`; transitions `academics.lifecycle.manage` and
 * campus-scoped through the WB1-6 `AccessScopeService` in the service. All routes
 * authenticated + RLS-scoped.
 */
@ApiTags('Student Lifecycle')
@Controller('academics/lifecycle')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class StudentLifecycleController {
  constructor(private readonly lifecycle: StudentLifecycleService) {}

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

  // ---- explain / read ----
  @Get('students/:studentId/placement')
  @RequirePermissions(['academics.lifecycle.view'])
  @ApiOperation({
    summary: "Explain a student's current placement + full history",
  })
  explain(
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.lifecycle.explainPlacement(tenantId, actor, studentId);
  }

  @Get('students/:studentId/history')
  @RequirePermissions(['academics.lifecycle.view'])
  @ApiOperation({ summary: "A student's placement history (durable spans)" })
  history(
    @Param('studentId') studentId: string,
    @Query() query: ListPlacementHistoryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.lifecycle.listPlacementHistory(
      tenantId,
      actor,
      studentId,
      query,
    );
  }

  @Get('next-student-number')
  @RequirePermissions(['academics.lifecycle.view'])
  @ApiOperation({ summary: 'Suggest the next student identifier (allocation)' })
  nextNumber(@Request() req: AuthenticatedRequest) {
    return this.lifecycle.suggestStudentNumber(this.ctx(req).tenantId);
  }

  // ---- transitions ----
  @Post('register')
  @RequirePermissions(['academics.lifecycle.manage'])
  @ApiOperation({
    summary: 'Register a student into a section (first placement)',
  })
  register(
    @Body() dto: RegisterStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.lifecycle.registerStudent(tenantId, actor, dto);
  }

  @Post('transfer')
  @RequirePermissions(['academics.lifecycle.manage'])
  @ApiOperation({
    summary: 'Transfer a student (keeps both placements with dates)',
  })
  transfer(
    @Body() dto: TransferStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.lifecycle.transferStudent(tenantId, actor, dto);
  }

  @Post('withdraw')
  @RequirePermissions(['academics.lifecycle.manage'])
  @ApiOperation({ summary: 'Withdraw a student (flips status; keeps history)' })
  withdraw(
    @Body() dto: WithdrawStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.lifecycle.withdrawStudent(tenantId, actor, dto);
  }

  @Post('graduate')
  @RequirePermissions(['academics.lifecycle.manage'])
  @ApiOperation({ summary: 'Graduate a student (flips status; keeps history)' })
  graduate(
    @Body() dto: GraduateStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.lifecycle.graduateStudent(tenantId, actor, dto);
  }
}
