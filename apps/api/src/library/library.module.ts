import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { LibraryController } from './controllers/library.controller';
import { LibraryService } from './services/library.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
