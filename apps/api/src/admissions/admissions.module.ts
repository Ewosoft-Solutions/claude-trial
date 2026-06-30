import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AdmissionsController } from './controllers/admissions.controller';
import { AdmissionsService } from './services/admissions.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
