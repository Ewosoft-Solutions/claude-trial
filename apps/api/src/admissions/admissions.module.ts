import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AcademicStructureModule } from '../academic-structure/academic-structure.module';
import { DocumentsModule } from '../documents/documents.module';
import { CommunicationModule } from '../communication/communication.module';
import { FormsModule } from '../forms/forms.module';
import { AdmissionsController } from './controllers/admissions.controller';
import { AdmissionFormsController } from './controllers/admission-forms.controller';
import { AdmissionInterviewsController } from './controllers/admission-interviews.controller';
import { PublicAdmissionsController } from './controllers/public-admissions.controller';
import { AdmissionsService } from './services/admissions.service';
import { AdmissionRequirementsService } from './services/admission-requirements.service';
import { AdmissionFormsService } from './services/admission-forms.service';
import { AdmissionInterviewsService } from './services/admission-interviews.service';
import { PublicAdmissionsService } from './services/public-admissions.service';

@Module({
  // AcademicStructureModule provides the WB2-3 StudentLifecycleService the
  // conversion reuses; AuthModule provides AccessScopeService (campus scope);
  // DocumentsModule provides the F4 DocumentService (requirement uploads → R2);
  // CommunicationModule provides the F5 SecureLinkService (applicant status
  // portal tokens).
  imports: [
    CommonModule,
    AuthModule,
    AcademicStructureModule,
    DocumentsModule,
    CommunicationModule,
    FormsModule,
  ],
  controllers: [
    AdmissionsController,
    // WB3-3 versioned application form + typed responses.
    AdmissionFormsController,
    // WB3-4 interview / exam scheduling + admission quiz.
    AdmissionInterviewsController,
    // Public applicant self-service (apply + status portal).
    PublicAdmissionsController,
  ],
  providers: [
    AdmissionsService,
    AdmissionRequirementsService,
    AdmissionFormsService,
    AdmissionInterviewsService,
    PublicAdmissionsService,
  ],
  exports: [
    AdmissionsService,
    AdmissionRequirementsService,
    AdmissionFormsService,
    AdmissionInterviewsService,
    PublicAdmissionsService,
  ],
})
export class AdmissionsModule {}
