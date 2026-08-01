import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { StudentDirectoryController } from './controllers/student-directory.controller';
import { SavedViewsController } from './controllers/saved-views.controller';
import { StudentDirectoryService } from './services/student-directory.service';
import { SavedViewService } from './services/saved-view.service';

/**
 * F7 — the governed directory pattern. One reusable server surface for entity
 * lists: a tenant + permission-filtered, privacy-aware projection (students
 * first) + tenant-owned saved views. The Aurora `DirectoryTable` +
 * `useDirectoryState` in `packages/ui` consume it.
 */
@Module({
  imports: [CommonModule, AuthModule, TenantModule],
  controllers: [StudentDirectoryController, SavedViewsController],
  providers: [StudentDirectoryService, SavedViewService],
  exports: [StudentDirectoryService, SavedViewService],
})
export class DirectoryModule {}
