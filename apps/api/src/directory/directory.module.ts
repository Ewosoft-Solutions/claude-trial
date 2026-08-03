import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { StudentDirectoryController } from './controllers/student-directory.controller';
import { PeopleDirectoryController } from './controllers/people-directory.controller';
import { SavedViewsController } from './controllers/saved-views.controller';
import { StudentDirectoryService } from './services/student-directory.service';
import { PeopleDirectoryService } from './services/people-directory.service';
import { SavedViewService } from './services/saved-view.service';

/**
 * F7 — the governed directory pattern. One reusable server surface for entity
 * lists: a tenant + permission-filtered, privacy-aware projection + tenant-owned
 * saved views. The Aurora `DirectoryTable` + `useDirectoryState` in
 * `packages/ui` consume it. WB1-1 adds the unified People projection (the
 * student/guardian/staff/user/prospect tabs of the People workbench).
 */
@Module({
  imports: [CommonModule, AuthModule, TenantModule],
  controllers: [
    StudentDirectoryController,
    PeopleDirectoryController,
    SavedViewsController,
  ],
  providers: [
    StudentDirectoryService,
    PeopleDirectoryService,
    SavedViewService,
  ],
  exports: [StudentDirectoryService, PeopleDirectoryService, SavedViewService],
})
export class DirectoryModule {}
