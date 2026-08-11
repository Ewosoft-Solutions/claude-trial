import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AcademicStructureModule } from '../academic-structure/academic-structure.module';
import { DocumentsModule } from '../documents/documents.module';
import { AdmissionsController } from './controllers/admissions.controller';
import { AdmissionFormsController } from './controllers/admission-forms.controller';
import { AdmissionInterviewsController } from './controllers/admission-interviews.controller';
import { AdmissionsService } from './services/admissions.service';
import { AdmissionRequirementsService } from './services/admission-requirements.service';
import { AdmissionFormsService } from './services/admission-forms.service';
import { AdmissionInterviewsService } from './services/admission-interviews.service';

@Module({
  // AcademicStructureModule provides the WB2-3 StudentLifecycleService the
  // conversion reuses; AuthModule provides AccessScopeService (campus scope);
  // DocumentsModule provides the F4 DocumentService (requirement uploads → R2).
  imports: [CommonModule, AuthModule, AcademicStructureModule, DocumentsModule],
  controllers: [
    AdmissionsController,
    // WB3-3 versioned application form + typed responses.
    AdmissionFormsController,
    // WB3-4 interview / exam scheduling + admission quiz.
    AdmissionInterviewsController,
  ],
  providers: [
    AdmissionsService,
    AdmissionRequirementsService,
    AdmissionFormsService,
    AdmissionInterviewsService,
  ],
  exports: [
    AdmissionsService,
    AdmissionRequirementsService,
    AdmissionFormsService,
    AdmissionInterviewsService,
  ],
})
export class AdmissionsModule {}
