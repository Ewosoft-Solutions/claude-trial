import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AcademicStructureService } from './services/academic-structure.service';
import { AcademicStructureModelService } from './services/academic-structure-model.service';
import { EnrollmentService } from './services/enrollment.service';
import { StudentLifecycleService } from './services/student-lifecycle.service';
import { PromotionService } from './services/promotion.service';
import { CurrentTermService } from './services/current-term.service';
import { AcademicYearController } from './controllers/academic-year.controller';
import { CourseController } from './controllers/course.controller';
import { ClassController } from './controllers/class.controller';
import { AcademicStructureModelController } from './controllers/academic-structure-model.controller';
import { EnrollmentController } from './controllers/enrollment.controller';
import { StudentLifecycleController } from './controllers/student-lifecycle.controller';
import { PromotionController } from './controllers/promotion.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [
    AcademicYearController,
    CourseController,
    ClassController,
    AcademicStructureModelController,
    EnrollmentController,
    StudentLifecycleController,
    PromotionController,
  ],
  providers: [
    AcademicStructureService,
    AcademicStructureModelService,
    EnrollmentService,
    StudentLifecycleService,
    PromotionService,
    CurrentTermService,
  ],
  exports: [
    AcademicStructureService,
    AcademicStructureModelService,
    EnrollmentService,
    StudentLifecycleService,
    PromotionService,
    CurrentTermService,
  ],
})
export class AcademicStructureModule {}
