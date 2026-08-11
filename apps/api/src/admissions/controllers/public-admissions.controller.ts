import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SwaggerTags } from '../../common/swagger-tags';
import { Public } from '../../auth/decorators/public.decorator';
import { PublicAdmissionsService } from '../services/public-admissions.service';
import {
  PublicApplyDto,
  PublicUploadDocumentDto,
} from '../dto/public-admissions.dto';

/**
 * WB3 · Public applicant self-service — the UNAUTHENTICATED admissions surface.
 * A parent applies from `/apply/[school]` and tracks + acts on the application
 * from a SecureLink status portal, no login. Every route is `@Public()`; the
 * school is resolved by slug and the status token is the only capability
 * (see PublicAdmissionsService). This POST is also the public intake API other
 * schools' own forms can submit to.
 */
@ApiTags(SwaggerTags.admissions.name)
@Controller('public/admissions')
export class PublicAdmissionsController {
  constructor(private readonly portal: PublicAdmissionsService) {}

  @Get('schools/:slug/intake')
  @Public()
  @ApiOperation({
    summary: 'The public apply form for a school (cascade + published form)',
  })
  intake(@Param('slug') slug: string) {
    return this.portal.getIntake(slug);
  }

  @Post('schools/:slug/apply')
  @Public()
  @ApiOperation({
    summary: 'Submit a public application (returns a status link)',
  })
  apply(
    @Param('slug') slug: string,
    @Body() dto: PublicApplyDto,
    @Ip() ip: string,
  ) {
    return this.portal.apply(slug, dto, ip);
  }

  @Get('status/:token')
  @Public()
  @ApiOperation({ summary: 'Track an application by its status token' })
  status(@Param('token') token: string) {
    return this.portal.getStatus(token);
  }

  @Post('status/:token/requirements/:reqId/document')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a required document via the status portal' })
  uploadDocument(
    @Param('token') token: string,
    @Param('reqId') reqId: string,
    @Body() dto: PublicUploadDocumentDto,
  ) {
    return this.portal.uploadDocument(token, reqId, dto);
  }

  @Post('status/:token/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an offer via the status portal' })
  accept(@Param('token') token: string) {
    return this.portal.accept(token);
  }
}
