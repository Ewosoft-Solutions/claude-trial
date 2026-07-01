import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { ParentPortalController } from './controllers/parent-portal.controller';
import { ParentPortalService } from './services/parent-portal.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [ParentPortalController],
  providers: [ParentPortalService],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}
