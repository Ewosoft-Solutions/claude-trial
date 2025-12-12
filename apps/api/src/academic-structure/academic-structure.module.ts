import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AcademicStructureService } from './services/academic-structure.service';
import { AcademicYearController } from './controllers/academic-year.controller';
import { CourseController } from './controllers/course.controller';
import { ClassController } from './controllers/class.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [AcademicYearController, CourseController, ClassController],
  providers: [AcademicStructureService],
  exports: [AcademicStructureService],
})
export class AcademicStructureModule {}

