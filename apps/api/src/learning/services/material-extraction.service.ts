import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import JSZip from 'jszip';

/**
 * Text extraction v1 (docs/ai-integration-plan.md Step 4): PDF, DOCX,
 * PPTX and plain text only — video and OCR are explicitly deferred.
 */

export const MATERIAL_KINDS = ['pdf', 'docx', 'pptx', 'txt'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

const MIME_TO_KIND: Record<string, MaterialKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'text/plain': 'txt',
  'text/markdown': 'txt',
};

const EXTENSION_TO_KIND: Record<string, MaterialKind> = {
  pdf: 'pdf',
  docx: 'docx',
  pptx: 'pptx',
  txt: 'txt',
  md: 'txt',
};

/**
 * Map an upload to a supported material kind, or null if unsupported.
 * Falls back to the file extension because browsers often send
 * application/octet-stream for Office files.
 */
export function resolveMaterialKind(
  mimeType: string | undefined,
  fileName: string,
): MaterialKind | null {
  const byMime = mimeType && MIME_TO_KIND[mimeType.split(';')[0].trim()];
  if (byMime) return byMime;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_KIND[extension] ?? null;
}

// ---- Material categories ---------------------------------------------
// Documents run the extraction/embedding pipeline; video/image/audio are
// stored and streamed as-is (learn-lift/gau file-catalog pattern — see
// docs/academics-reuse-assessment.md §2.2).

export const MATERIAL_CATEGORIES = [
  'document',
  'video',
  'image',
  'audio',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

const MEDIA_MIME_TO_CATEGORY: Record<string, MaterialCategory> = {
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
};

const MEDIA_EXTENSION_TO_CATEGORY: Record<string, MaterialCategory> = {
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  mp3: 'audio',
  m4a: 'audio',
  wav: 'audio',
  ogg: 'audio',
};

/** Per-category upload caps (bytes). */
export const CATEGORY_MAX_BYTES: Record<MaterialCategory, number> = {
  document: 20 * 1024 * 1024, // 20 MB
  image: 20 * 1024 * 1024, // 20 MB
  audio: 50 * 1024 * 1024, // 50 MB
  video: 250 * 1024 * 1024, // 250 MB
};

export interface ResolvedMaterial {
  category: MaterialCategory;
  /** Set only for documents — feeds the extraction pipeline. */
  kind: MaterialKind | null;
}

/**
 * Classify an upload: extractable document, streamable media, or
 * unsupported (null).
 */
export function resolveMaterial(
  mimeType: string | undefined,
  fileName: string,
): ResolvedMaterial | null {
  const kind = resolveMaterialKind(mimeType, fileName);
  if (kind) return { category: 'document', kind };

  const byMime =
    mimeType && MEDIA_MIME_TO_CATEGORY[mimeType.split(';')[0].trim()];
  if (byMime) return { category: byMime, kind: null };

  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const byExtension = MEDIA_EXTENSION_TO_CATEGORY[extension];
  return byExtension ? { category: byExtension, kind: null } : null;
}

export class UnsupportedMaterialError extends Error {
  constructor(mimeType: string | undefined, fileName: string) {
    super(
      `Unsupported material type (${mimeType ?? 'unknown mime'}, ${fileName}). ` +
        'Supported: PDF, DOCX, PPTX, TXT/MD, MP4/WEBM/MOV, PNG/JPG/WEBP/GIF, MP3/M4A/WAV/OGG.',
    );
    this.name = 'UnsupportedMaterialError';
  }
}

@Injectable()
export class MaterialExtractionService {
  /** Extract plain text from a supported material buffer. */
  async extractText(buffer: Buffer, kind: MaterialKind): Promise<string> {
    switch (kind) {
      case 'pdf':
        return this.extractPdf(buffer);
      case 'docx':
        return this.extractDocx(buffer);
      case 'pptx':
        return this.extractPptx(buffer);
      case 'txt':
        return buffer.toString('utf8');
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private async extractPptx(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => slideNumber(a) - slideNumber(b));

    const slides: string[] = [];
    for (const name of slideNames) {
      const xml = await zip.files[name].async('string');
      const runs = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) =>
        decodeXmlEntities(m[1]),
      );
      if (runs.length > 0) slides.push(runs.join(' '));
    }
    return slides.join('\n\n');
  }
}

function slideNumber(name: string): number {
  return Number(/slide(\d+)\.xml$/.exec(name)?.[1] ?? 0);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
