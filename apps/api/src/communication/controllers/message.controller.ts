import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { CommunicationService } from '../services/communication.service';
import { CreateMessageDto, MarkMessageReadDto, ListMessagesDto } from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.messages.name)
@Controller('messages')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class MessageController {
  constructor(private readonly commService: CommunicationService) {}

  @Post()
  @RequirePermissions(['messages.send'])
  @ApiOperation({ summary: 'Send message' })
  async send(
    @Body() dto: CreateMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.commService.sendMessage(user.tenantId, user.profileId!, dto);
  }

  @Get('inbox')
  @RequirePermissions(['messages.view'])
  @ApiOperation({ summary: 'List inbox messages' })
  async inbox(
    @Query() query: ListMessagesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.commService.listInbox(user.tenantId, user.profileId!, query);
  }

  @Get('sent')
  @RequirePermissions(['messages.view'])
  @ApiOperation({ summary: 'List sent messages' })
  async sent(
    @Query() query: ListMessagesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.commService.listSent(user.tenantId, user.profileId!, query);
  }

  @Get('thread/:id')
  @RequirePermissions(['messages.view'])
  @ApiOperation({ summary: 'Get message thread' })
  async thread(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    return this.commService.getThread(user.tenantId, user.profileId!, id);
  }

  @Post('read')
  @RequirePermissions(['messages.view'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark message as read' })
  async markRead(
    @Body() dto: MarkMessageReadDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.commService.markRead(user.tenantId, user.profileId!, dto);
  }
}
