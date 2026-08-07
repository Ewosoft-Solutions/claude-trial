import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AcademicStructureModule } from '../academic-structure/academic-structure.module';
import { DocumentsModule } from '../documents/documents.module';
import { AdmissionsController } from './controllers/admissions.controller';
import { AdmissionsService } from './services/admissions.service';
import { AdmissionRequirementsService } from './services/admission-requirements.service';

@Module({
  // AcademicStructureModule provides the WB2-3 StudentLifecycleService the
  // conversion reuses; AuthModule provides AccessScopeService (campus scope);
  // DocumentsModule provides the F4 DocumentService (requirement uploads → R2).
  imports: [CommonModule, AuthModule, AcademicStructureModule, DocumentsModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService, AdmissionRequirementsService],
  exports: [AdmissionsService, AdmissionRequirementsService],
})
export class AdmissionsModule {}
