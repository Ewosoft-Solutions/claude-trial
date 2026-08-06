import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AcademicStructureModule } from '../academic-structure/academic-structure.module';
import { AdmissionsController } from './controllers/admissions.controller';
import { AdmissionsService } from './services/admissions.service';

@Module({
  // AcademicStructureModule provides the WB2-3 StudentLifecycleService the
  // conversion reuses; AuthModule provides AccessScopeService (campus scope).
  imports: [CommonModule, AuthModule, AcademicStructureModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
