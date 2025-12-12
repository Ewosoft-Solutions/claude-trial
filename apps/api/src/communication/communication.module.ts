import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { CommunicationService } from './services/communication.service';
import { AnnouncementController } from './controllers/announcement.controller';
import { MessageController } from './controllers/message.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [AnnouncementController, MessageController],
  providers: [CommunicationService],
  exports: [CommunicationService],
})
export class CommunicationModule {}

