import { IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { CreateApplicationDto } from './admissions.dto';
import { UploadRequirementDocumentDto } from './admissions.dto';

/**
 * Public (unauthenticated) application submission — the same structured intake a
 * staff member captures, plus the answers to the school's published application
 * form. Inherits every validation rule from {@link CreateApplicationDto} (a
 * guardian with a contact phone is required), so the public path can't submit a
 * looser shape than the internal one.
 */
export class PublicApplyDto extends CreateApplicationDto {
  @ApiPropertyOptional({
    description:
      'Answers to the current published application form, keyed by field key.',
  })
  @IsOptional()
  @IsObject()
  formAnswers?: Record<string, unknown>;
}

/** A document uploaded through the status portal reuses the internal upload DTO. */
export class PublicUploadDocumentDto extends UploadRequirementDocumentDto {}
