import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { LearningController } from './controllers/learning.controller';
import { LearningService } from './services/learning.service';
import { LearningRetrievalService } from './services/learning-retrieval.service';
import { MaterialExtractionService } from './services/material-extraction.service';
import { MaterialIngestionService } from './services/material-ingestion.service';

/**
 * Learning domain (docs/ai-integration-plan.md Step 4): lessons +
 * uploaded materials + the chunk/embedding substrate the Academic AI
 * tutor retrieves from. Imports AiModule for the EmbeddingsProvider port.
 */
@Module({
  imports: [CommonModule, AuthModule, AiModule],
  controllers: [LearningController],
  providers: [
    LearningService,
    LearningRetrievalService,
    MaterialExtractionService,
    MaterialIngestionService,
  ],
  exports: [LearningService, LearningRetrievalService],
})
export class LearningModule {}
