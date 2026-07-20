/**
 * AI Tutor Module (Step 5, docs/ai-integration-plan.md).
 *
 * The Academic AI tutor: a lesson-scoped RAG chatbot for students, built on
 * the Step 4 learning substrate (retrieval + materials) and the Step 1/2 AI
 * plumbing (LlmProvider port, mediator, throttle).
 *
 * Kept in its own module rather than folded into AiModule to avoid a cycle:
 * LearningModule already imports AiModule (for the EmbeddingsProvider), and
 * the tutor depends on LearningModule. This module sits on top of both.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from './ai.module';
import { LearningModule } from '../learning/learning.module';
import { aiConfig } from './config/ai.config';
import { AiAcademicController } from './controllers/ai-academic.controller';
import { AcademicChatService } from './services/academic-chat.service';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    AiModule,
    LearningModule,
    // AcademicChatService injects the validated 'ai' config; register the
    // feature loader here too (AiModule keeps its own registration private).
    ConfigModule.forFeature(aiConfig),
  ],
  controllers: [AiAcademicController],
  providers: [AcademicChatService],
  exports: [AcademicChatService],
})
export class AiTutorModule {}
