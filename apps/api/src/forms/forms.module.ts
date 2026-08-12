import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { DocumentsModule } from '../documents/documents.module';
import { FormsService } from './forms.service';

/**
 * Form Engine (P1) — the generic, reusable Forms subsystem. Exports FormsService
 * so any domain (admissions, HR, …) can own + version forms and capture
 * responses. CommonModule provides the tenant-scoped client + audit;
 * DocumentsModule provides the F4 DocumentService for `file` items.
 */
@Module({
  imports: [CommonModule, DocumentsModule],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
