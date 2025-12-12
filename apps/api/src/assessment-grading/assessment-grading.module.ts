import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AssessmentGradingService } from './services/assessment-grading.service';
import { GradingSystemController } from './controllers/grading-system.controller';
import { AssessmentController } from './controllers/assessment.controller';
import { GradeController } from './controllers/grade.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [GradingSystemController, AssessmentController, GradeController],
  providers: [AssessmentGradingService],
  exports: [AssessmentGradingService],
})
export class AssessmentGradingModule {}

