import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AssessmentGradingService } from './services/assessment-grading.service';
import { QuestionBankService } from './services/question-bank.service';
import { AssessmentTakingService } from './services/assessment-taking.service';
import { GradingSystemController } from './controllers/grading-system.controller';
import { AssessmentController } from './controllers/assessment.controller';
import { GradeController } from './controllers/grade.controller';
import { QuestionController } from './controllers/question.controller';
import { AssessmentTakingController } from './controllers/assessment-taking.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [
    GradingSystemController,
    AssessmentController,
    GradeController,
    QuestionController,
    AssessmentTakingController,
  ],
  providers: [
    AssessmentGradingService,
    QuestionBankService,
    AssessmentTakingService,
  ],
  exports: [AssessmentGradingService, QuestionBankService, AssessmentTakingService],
})
export class AssessmentGradingModule {}
