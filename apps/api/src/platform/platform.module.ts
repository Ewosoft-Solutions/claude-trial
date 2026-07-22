import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { PlatformController } from './controllers/platform.controller';
import { PlatformOverviewService } from './services/platform-overview.service';

/**
 * Platform Module
 *
 * Cross-tenant platform-operator features (the platform console's own APIs, as
 * distinct from the per-tenant management under TenantModule). Handlers here are
 * `@PlatformScoped` and read across tenants through the audited RLS scope.
 */
@Module({
  imports: [CommonModule, AuthModule],
  controllers: [PlatformController],
  providers: [PlatformOverviewService],
  exports: [PlatformOverviewService],
})
export class PlatformModule {}
