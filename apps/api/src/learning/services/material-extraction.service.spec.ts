import JSZip from 'jszip';
import {
  MaterialExtractionService,
  resolveMaterialKind,
} from './material-extraction.service';

describe('resolveMaterialKind', () => {
  it('maps supported mime types', () => {
    expect(resolveMaterialKind('application/pdf', 'x.bin')).toBe('pdf');
    expect(
      resolveMaterialKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'x.bin',
      ),
    ).toBe('docx');
    expect(
      resolveMaterialKind(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'x.bin',
      ),
    ).toBe('pptx');
    expect(resolveMaterialKind('text/plain', 'x.bin')).toBe('txt');
    expect(resolveMaterialKind('text/plain; charset=utf-8', 'x.bin')).toBe('txt');
  });

  it('falls back to the file extension for generic mimes', () => {
    expect(resolveMaterialKind('application/octet-stream', 'notes.PDF')).toBe('pdf');
    expect(resolveMaterialKind(undefined, 'slides.pptx')).toBe('pptx');
    expect(resolveMaterialKind('application/octet-stream', 'readme.md')).toBe('txt');
  });

  it('returns null for unsupported uploads (video/OCR deferred)', () => {
    expect(resolveMaterialKind('video/mp4', 'lecture.mp4')).toBeNull();
    expect(resolveMaterialKind('image/png', 'scan.png')).toBeNull();
    expect(resolveMaterialKind('application/octet-stream', 'blob')).toBeNull();
  });
});

describe('MaterialExtractionService', () => {
  const service = new MaterialExtractionService();

  it('extracts plain text as utf8', async () => {
    const text = 'Line one\nLine two — naïve café';
    await expect(
      service.extractText(Buffer.from(text, 'utf8'), 'txt'),
    ).resolves.toBe(text);
  });

  it('extracts pptx slide text in slide order and decodes entities', async () => {
    const zip = new JSZip();
    const slideXml = (runs: string[]) =>
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      runs.map((r) => `<a:t>${r}</a:t>`).join('<a:br/>') +
      `</p:sld>`;
    // Add out of order to prove numeric sorting (slide10 after slide2).
    zip.file('ppt/slides/slide10.xml', slideXml(['Third slide']));
    zip.file('ppt/slides/slide1.xml', slideXml(['Cells &amp; Energy', 'Intro']));
    zip.file('ppt/slides/slide2.xml', slideXml(['Mitochondria &lt;matter&gt;']));
    zip.file('ppt/notesSlides/notesSlide1.xml', slideXml(['ignored notes']));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const text = await service.extractText(buffer, 'pptx');
    expect(text).toBe(
      'Cells & Energy Intro\n\nMitochondria <matter>\n\nThird slide',
    );
  });
});
