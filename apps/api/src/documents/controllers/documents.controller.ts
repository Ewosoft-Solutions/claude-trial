import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { PermissionService } from '../../auth/services/permission.service';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { DocumentService } from '../services/document.service';
import { SignatureService } from '../services/signature.service';
import {
  UploadDocumentDto,
  SetLegalHoldDto,
  RegisterSigningAuthorityDto,
  ApplySignatureDto,
} from '../dto/document.dto';

/**
 * Document + signature API (F4 / ADR-08). All routes are authenticated,
 * tenant-scoped, and permission-checked server-side. Downloads are served only
 * through a signed short-lived token (never a browsable path); signature use is
 * authorized per artifact.
 */
@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentService,
    private readonly signatures: SignatureService,
    private readonly permissionService: PermissionService,
  ) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('User context not found');
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  private canDownloadSensitive(req: AuthenticatedRequest): boolean {
    return (
      !!req.userContext &&
      this.permissionService.checkPermissions(req.userContext, [
        'documents.download_sensitive',
      ]).granted
    );
  }

  @Post()
  @RequirePermissions(['documents.upload'])
  @ApiOperation({ summary: 'Upload a document (bytes base64-encoded)' })
  async upload(@Body() dto: UploadDocumentDto, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.ctx(req);
    return this.documents.upload(tenantId, userId, {
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      typeKey: dto.typeKey,
      title: dto.title,
      visibility: dto.visibility,
      sensitive: dto.sensitive,
      mime: dto.mime,
      filename: dto.filename,
      content: Buffer.from(dto.contentBase64, 'base64'),
      sourceSystem: dto.sourceSystem,
      sourceId: dto.sourceId,
    });
  }

  @Get()
  @RequirePermissions(['documents.view'])
  @ApiOperation({ summary: 'List documents for an owner (signature assets excluded)' })
  async list(
    @Query('ownerType') ownerType: string,
    @Query('ownerId') ownerId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.documents.listForOwner(tenantId, ownerType, ownerId);
  }

  // Static path before ':id' so it is not captured as an id.
  @Get('download')
  @ApiOperation({ summary: 'Resolve a signed download token to the file bytes' })
  async download(
    @Query('token') token: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { tenantId, userId } = this.ctx(req);
    const file = await this.documents.resolveDownload(tenantId, userId, token);
    res.setHeader('Content-Type', file.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get(':id')
  @RequirePermissions(['documents.view'])
  @ApiOperation({ summary: 'Get document metadata + versions' })
  async get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId } = this.ctx(req);
    return this.documents.get(tenantId, id);
  }

  @Get(':id/download-url')
  @RequirePermissions(['documents.view'])
  @ApiOperation({ summary: 'Mint a signed short-lived download URL' })
  async downloadUrl(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.ctx(req);
    return this.documents.mintDownloadUrl(
      tenantId,
      userId,
      id,
      this.canDownloadSensitive(req),
    );
  }

  @Post(':id/legal-hold')
  @RequirePermissions(['documents.manage'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Place or release a legal hold' })
  async legalHold(
    @Param('id') id: string,
    @Body() dto: SetLegalHoldDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.documents.setLegalHold(tenantId, userId, id, dto.hold);
  }

  @Delete(':id')
  @RequirePermissions(['documents.manage'])
  @ApiOperation({ summary: 'Delete a document (refused under legal hold)' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.ctx(req);
    return this.documents.delete(tenantId, userId, id);
  }

  // ---- Signatures ---------------------------------------------------

  @Post('signing-authorities')
  @RequirePermissions(['signatures.manage'])
  @ApiOperation({ summary: 'Register a signing authority for a person + role' })
  async registerAuthority(
    @Body() dto: RegisterSigningAuthorityDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.signatures.registerAuthority(tenantId, userId, dto);
  }

  @Post('signing-authorities/:id/revoke')
  @RequirePermissions(['signatures.manage'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a signing authority' })
  async revokeAuthority(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.signatures.revokeAuthority(tenantId, userId, id);
  }

  @Post('signatures/apply')
  @RequirePermissions(['signatures.apply'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a signature to an artifact via an authorized use' })
  async applySignature(
    @Body() dto: ApplySignatureDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.signatures.applySignature(tenantId, userId, dto);
  }

  @Get('signatures/uses')
  @RequirePermissions(['documents.view'])
  @ApiOperation({ summary: 'List signature uses for an artifact' })
  async listUses(
    @Query('artifactType') artifactType: string,
    @Query('artifactId') artifactId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.signatures.listUses(tenantId, artifactType, artifactId);
  }
}
