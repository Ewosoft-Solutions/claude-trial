import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommunicationModule } from '../communication/communication.module';
import { AccountProvisioningController } from './controllers/account-provisioning.controller';
import { AccountProvisioningService } from './services/account-provisioning.service';

/**
 * Account provisioning (WB1-3): secure invitations (SecureLink + F5 delivery),
 * activation/suspension, and admin-initiated password reset for the People
 * workbench. Reuses TenantModule's UserInvitationService (grandfathered
 * privileged client for the tenant-global users table) and the F5 delivery /
 * secure-link services from CommunicationModule; no plaintext password is ever
 * generated or transmitted.
 */
@Module({
  imports: [CommonModule, AuthModule, TenantModule, CommunicationModule],
  controllers: [AccountProvisioningController],
  providers: [AccountProvisioningService],
  exports: [AccountProvisioningService],
})
export class ProvisioningModule {}
