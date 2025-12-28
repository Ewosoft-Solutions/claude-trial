import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { StudentController } from './controllers/student.controller';
import { StudentService } from './services/student.service';

@Module({
  imports: [CommonModule, AuthModule, TenantModule],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule {}
