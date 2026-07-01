import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { HrController } from './controllers/hr.controller';
import { HrService } from './services/hr.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
