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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { CommunicationService } from '../services/communication.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  ListAnnouncementsDto,
} from '../dto';
import { RequestUser } from '../../auth/types/request-user';

@ApiTags('announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AnnouncementController {
  constructor(private readonly commService: CommunicationService) {}

  @Post()
  @RequirePermissions(['announcements.create'])
  @ApiOperation({ summary: 'Create announcement' })
  async create(
    @Body() dto: CreateAnnouncementDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.commService.createAnnouncement(user.tenantId, user.profileId!, dto);
  }

  @Get()
  @RequirePermissions(['announcements.view'])
  @ApiOperation({ summary: 'List announcements' })
  async list(
    @Query() query: ListAnnouncementsDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.commService.listAnnouncements(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(['announcements.view'])
  @ApiOperation({ summary: 'Get announcement by ID' })
  async get(@Param('id') id: string, @Request() req: { user?: RequestUser }) {
    const user = req.user!;
    return this.commService.getAnnouncement(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermissions(['announcements.edit'])
  @ApiOperation({ summary: 'Update announcement' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.commService.updateAnnouncement(user.tenantId, user.profileId!, id, dto);
  }

  @Patch(':id/publish')
  @RequirePermissions(['announcements.edit'])
  @ApiOperation({ summary: 'Publish announcement' })
  async publish(@Param('id') id: string, @Request() req: { user?: RequestUser }) {
    const user = req.user!;
    return this.commService.publishAnnouncement(user.tenantId, user.profileId!, id);
  }

  @Patch(':id/archive')
  @RequirePermissions(['announcements.edit'])
  @ApiOperation({ summary: 'Archive announcement' })
  async archive(@Param('id') id: string, @Request() req: { user?: RequestUser }) {
    const user = req.user!;
    return this.commService.archiveAnnouncement(user.tenantId, user.profileId!, id);
  }

  @Delete(':id')
  @RequirePermissions(['announcements.delete'])
  @ApiOperation({ summary: 'Delete announcement' })
  async delete(@Param('id') id: string, @Request() req: { user?: RequestUser }) {
    const user = req.user!;
    return this.commService.deleteAnnouncement(user.tenantId, id);
  }
}

