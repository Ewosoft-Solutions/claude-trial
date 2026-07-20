/**
 * The active API e2e suites exercise text-material processing, not PDF
 * extraction. Avoid loading pdf-parse's native canvas GC in every AppModule
 * test; a PDF-specific e2e must opt into the real module explicitly.
 */
export class PDFParse {
  constructor() {
    throw new Error(
      'PDF parsing is not enabled in the default e2e environment.',
    );
  }

  async getText(): Promise<{ text: string }> {
    return { text: '' };
  }

  async destroy(): Promise<void> {}
}
