import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PermissionMode } from '@workspace/api';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import {
  buildAcademicsActor,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import { LearningService } from '../services/learning.service';
import { LearningRetrievalService } from '../services/learning-retrieval.service';
import {
  CreateLessonDto,
  ListLessonsDto,
  ReviewDecisionDto,
  SearchChunksDto,
  UpdateLessonDto,
  UploadMaterialDto,
} from '../dto/learning.dto';
import type { AuthenticatedRequest } from 'src/auth';

// Multer cap = largest per-category cap (video); the service enforces the
// tighter per-category limits after classification.
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

const VIEW_PERMISSIONS = ['lessons.view', 'lessons.view.own'];

/**
 * NOT @TenantScoped, deliberately (the AI-module discipline): material
 * ingestion and query embedding involve provider round-trips that must
 * never run inside a 15s RLS transaction. LearningService opens its own
 * short runScoped units instead.
 */
@ApiTags(SwaggerTags.learning.name)
@Controller('learning')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly retrievalService: LearningRetrievalService,
  ) {}

  /** Record-level access facts from the guard's cached permission context. */
  private actorFrom(req: AuthenticatedRequest): AcademicsActor {
    if (!req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return buildAcademicsActor(
      req.userContext,
      'lessons.view',
      'lessons.manage.all',
    );
  }

  @Get('lessons')
  @RequirePermissions(VIEW_PERMISSIONS, PermissionMode.ANY)
  @ApiOperation({ summary: 'List lessons (students: published + approved, enrolled classes only)' })
  async listLessons(
    @Query() query: ListLessonsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.listLessons(
      req.user!.tenantId,
      query,
      this.actorFrom(req),
    );
  }

  @Post('lessons')
  @RequirePermissions(['lessons.create'])
  @ApiOperation({ summary: 'Create a lesson for a class you teach' })
  async createLesson(
    @Body() dto: CreateLessonDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.createLesson(
      req.user!.tenantId,
      dto,
      this.actorFrom(req),
    );
  }

  @Get('lessons/:id')
  @RequirePermissions(VIEW_PERMISSIONS, PermissionMode.ANY)
  @ApiOperation({ summary: 'Get a lesson with its materials' })
  async getLesson(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.getLesson(
      req.user!.tenantId,
      id,
      this.actorFrom(req),
    );
  }

  @Patch('lessons/:id')
  @RequirePermissions(['lessons.edit'])
  @ApiOperation({
    summary:
      'Update a lesson (content edits reset approval; publishing requires approval)',
  })
  async updateLesson(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.updateLesson(
      req.user!.tenantId,
      id,
      dto,
      this.actorFrom(req),
    );
  }

  @Delete('lessons/:id')
  @RequirePermissions(['lessons.delete'])
  @ApiOperation({ summary: 'Delete a lesson (and its materials/chunks)' })
  async deleteLesson(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.deleteLesson(
      req.user!.tenantId,
      id,
      this.actorFrom(req),
    );
  }

  // ---- Review workflow ------------------------------------------------

  @Post('lessons/:id/submit-review')
  @RequirePermissions(['lessons.edit'])
  @ApiOperation({ summary: 'Submit a lesson for approval' })
  async submitLessonForReview(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.submitLessonForReview(
      req.user!.tenantId,
      id,
      this.actorFrom(req),
    );
  }

  @Post('lessons/:id/approve')
  @RequirePermissions(['lessons.approve'])
  @ApiOperation({ summary: 'Approve a lesson awaiting review' })
  async approveLesson(
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.reviewLesson(
      req.user!.tenantId,
      id,
      'approved',
      dto,
      this.actorFrom(req),
    );
  }

  @Post('lessons/:id/reject')
  @RequirePermissions(['lessons.approve'])
  @ApiOperation({ summary: 'Reject a lesson awaiting review (note required)' })
  async rejectLesson(
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.reviewLesson(
      req.user!.tenantId,
      id,
      'rejected',
      dto,
      this.actorFrom(req),
    );
  }

  @Post('materials/:id/approve')
  @RequirePermissions(['lessons.approve'])
  @ApiOperation({ summary: 'Approve an uploaded material (makes it visible to students)' })
  async approveMaterial(
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.reviewMaterial(
      req.user!.tenantId,
      id,
      'approved',
      dto,
      this.actorFrom(req),
    );
  }

  @Post('materials/:id/reject')
  @RequirePermissions(['lessons.approve'])
  @ApiOperation({ summary: 'Reject an uploaded material (note required)' })
  async rejectMaterial(
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.reviewMaterial(
      req.user!.tenantId,
      id,
      'rejected',
      dto,
      this.actorFrom(req),
    );
  }

  // ---- Materials ------------------------------------------------------

  @Get('lessons/:id/materials')
  @RequirePermissions(VIEW_PERMISSIONS, PermissionMode.ANY)
  @ApiOperation({ summary: 'List materials for a lesson (students: approved only)' })
  async listMaterials(
    @Param('id') lessonId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.listMaterials(
      req.user!.tenantId,
      lessonId,
      this.actorFrom(req),
    );
  }

  @Post('lessons/:id/materials')
  @RequirePermissions(['lessons.materials.upload'])
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Upload a material (documents queue extraction; video/image/audio stored for streaming). Awaits approval before students can see it.',
  })
  async uploadMaterial(
    @Param('id') lessonId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMaterialDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required (multipart field "file")');
    }
    return this.learningService.uploadMaterial(
      req.user!.tenantId,
      lessonId,
      file,
      dto,
      this.actorFrom(req),
    );
  }

  @Get('materials/:id/download')
  @RequirePermissions(VIEW_PERMISSIONS, PermissionMode.ANY)
  @ApiOperation({ summary: 'Download/stream a material binary' })
  async downloadMaterial(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { object, fileName, mimeType } =
      await this.learningService.downloadMaterial(
        req.user!.tenantId,
        id,
        this.actorFrom(req),
      );
    res.setHeader('Content-Type', object.contentType ?? mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName.replace(/[^\w.-]+/g, '_')}"`,
    );
    return new StreamableFile(object.data);
  }

  @Post('materials/:id/reprocess')
  @RequirePermissions(['lessons.materials.upload'])
  @ApiOperation({ summary: 'Re-queue extraction + embedding for a document material' })
  async reprocessMaterial(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.reprocessMaterial(
      req.user!.tenantId,
      id,
      this.actorFrom(req),
    );
  }

  @Delete('materials/:id')
  @RequirePermissions(['lessons.materials.delete'])
  @ApiOperation({ summary: 'Delete a material (rows + stored binary)' })
  async deleteMaterial(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.learningService.deleteMaterial(
      req.user!.tenantId,
      id,
      this.actorFrom(req),
    );
  }

  @Post('lessons/:id/search')
  @RequirePermissions(VIEW_PERMISSIONS, PermissionMode.ANY)
  @ApiOperation({
    summary:
      'Similarity search over one lesson\'s material chunks (tutor retrieval)',
  })
  async searchLesson(
    @Param('id') lessonId: string,
    @Body() dto: SearchChunksDto,
    @Request() req: AuthenticatedRequest,
  ) {
    // 404 before searching so lesson ids can't be probed across scopes
    // (also applies the student visibility rules).
    await this.learningService.getLesson(
      req.user!.tenantId,
      lessonId,
      this.actorFrom(req),
    );
    return this.retrievalService.searchLesson(
      req.user!.tenantId,
      lessonId,
      dto.query,
      dto.topK ?? 5,
      req.user!.userId,
    );
  }
}
