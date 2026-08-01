/** Durable job types for the document pipeline (F4 / ADR-08), run on F3. */
export const DOCUMENT_SCAN_JOB = 'document.scan';
export const DOCUMENT_THUMBNAIL_JOB = 'document.thumbnail';

export interface DocumentScanPayload {
  documentId: string;
  versionId: string;
}

export interface DocumentThumbnailPayload {
  documentId: string;
  versionId: string;
}
