import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { CurriculumService } from './services/curriculum.service';
import { CurriculumAdoptionService } from './services/curriculum-adoption.service';
import { CurriculumOverlayService } from './services/curriculum-overlay.service';
import { CurriculumMappingService } from './services/curriculum-mapping.service';
import { CurriculumController } from './controllers/curriculum.controller';
import { CurriculumAdoptionController } from './controllers/curriculum-adoption.controller';
import { CurriculumCustomizationController } from './controllers/curriculum-customization.controller';

/**
 * Curriculum — academic-profile + policy-version framework (F6 / ADR-03).
 * Versioned, effective-dated, provenance-bearing curriculum with national
 * immutability, tenant overlays, cohort adoption, and subject-alias de-dup.
 */
@Module({
  imports: [CommonModule, AuthModule],
  controllers: [
    CurriculumController,
    CurriculumAdoptionController,
    CurriculumCustomizationController,
  ],
  providers: [
    CurriculumService,
    CurriculumAdoptionService,
    CurriculumOverlayService,
    CurriculumMappingService,
  ],
  exports: [
    CurriculumService,
    CurriculumAdoptionService,
    CurriculumOverlayService,
    CurriculumMappingService,
  ],
})
export class CurriculumModule {}
