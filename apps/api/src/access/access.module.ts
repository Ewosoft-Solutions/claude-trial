import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AccessGrantController } from './controllers/access-grant.controller';
import { CampusController } from './controllers/campus.controller';
import { AccessGrantService } from './services/access-grant.service';
import { CampusService } from './services/campus.service';

/**
 * Access (WB1-6): time-boxed + scoped role grants with maker-checker/step-up for
 * the high-risk ones, plus the campuses a grant is scoped to. Reuses AuthModule's
 * EffectiveAccessService (to flag a sensitive role high-risk), MakerCheckerService
 * (second-approver + separation-of-duties), AccessScopeService (campus-scope
 * enforcement) and the step-up guard; CommonModule provides the RLS-scoped
 * TenantDbService client + AuditService. No privileged client.
 */
@Module({
  imports: [CommonModule, AuthModule],
  controllers: [AccessGrantController, CampusController],
  providers: [AccessGrantService, CampusService],
  exports: [AccessGrantService, CampusService],
})
export class AccessModule {}
