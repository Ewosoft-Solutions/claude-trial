import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AcademicStructureService } from './services/academic-structure.service';
import { AcademicStructureModelService } from './services/academic-structure-model.service';
import { EnrollmentService } from './services/enrollment.service';
import { CurrentTermService } from './services/current-term.service';
import { AcademicYearController } from './controllers/academic-year.controller';
import { CourseController } from './controllers/course.controller';
import { ClassController } from './controllers/class.controller';
import { AcademicStructureModelController } from './controllers/academic-structure-model.controller';
import { EnrollmentController } from './controllers/enrollment.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [
    AcademicYearController,
    CourseController,
    ClassController,
    AcademicStructureModelController,
    EnrollmentController,
  ],
  providers: [
    AcademicStructureService,
    AcademicStructureModelService,
    EnrollmentService,
    CurrentTermService,
  ],
  exports: [
    AcademicStructureService,
    AcademicStructureModelService,
    EnrollmentService,
    CurrentTermService,
  ],
})
export class AcademicStructureModule {}
