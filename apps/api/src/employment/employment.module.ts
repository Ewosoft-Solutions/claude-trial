import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { StaffEmploymentController } from './controllers/staff-employment.controller';
import { StaffEmploymentService } from './services/staff-employment.service';

/**
 * Staff employment (WB1-2): first-class, managed employment records for the
 * People workbench — created / updated / disabled independent of any payroll
 * run (retires payroll-as-directory). Reuses CommonModule's TenantDbService +
 * AuditService; guards come from AuthModule. No new permissions (reuses the
 * existing staff.* catalog).
 */
@Module({
  imports: [CommonModule, AuthModule],
  controllers: [StaffEmploymentController],
  providers: [StaffEmploymentService],
  exports: [StaffEmploymentService],
})
export class EmploymentModule {}
