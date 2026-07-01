import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { EventsService } from '../services/events.service';
import { CreateEventDto, ListEventsDto, UpdateEventDto } from '../dto/events.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.events.name)
@Controller('events')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @RequirePermissions(['events.view'])
  @ApiOperation({ summary: 'List school events' })
  async listEvents(@Query() query: ListEventsDto, @Request() req: AuthenticatedRequest) {
    return this.eventsService.listEvents(req.user.tenantId, query);
  }

  @Get('summary')
  @RequirePermissions(['events.view'])
  @ApiOperation({ summary: 'Events summary (status + type counts)' })
  async eventsSummary(@Request() req: AuthenticatedRequest) {
    return this.eventsService.eventsSummary(req.user.tenantId);
  }

  @Post()
  @RequirePermissions(['events.create'])
  @ApiOperation({ summary: 'Create a school event' })
  async createEvent(@Body() dto: CreateEventDto, @Request() req: AuthenticatedRequest) {
    return this.eventsService.createEvent(req.user.tenantId, dto, req.user.profileId!);
  }

  @Patch(':id')
  @RequirePermissions(['events.edit'])
  @ApiOperation({ summary: 'Update a school event' })
  async updateEvent(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.updateEvent(req.user.tenantId, id, dto, req.user.profileId!);
  }
}
