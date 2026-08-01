import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { PersonController } from './controllers/person.controller';
import { PersonService } from './services/person.service';
import { PersonMergeService } from './services/person-merge.service';

/**
 * Person foundation (F1 / ADR-01): one tenant-scoped human anchor with linked
 * account, profiles (staff/student/guardian) and contacts, plus dedup/merge.
 * Consumed by the People workbench (WB1) and by the import platform (F2).
 */
@Module({
  imports: [CommonModule, AuthModule, TenantModule],
  controllers: [PersonController],
  providers: [PersonService, PersonMergeService],
  exports: [PersonService, PersonMergeService],
})
export class PersonModule {}
