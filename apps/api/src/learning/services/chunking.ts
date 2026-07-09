/**
 * Text chunking for lesson-material retrieval.
 *
 * Pure function, no I/O: splits extracted text into overlapping chunks
 * sized for embedding. Prefers paragraph boundaries, falls back to
 * sentence-ish breaks, and hard-splits only when a single block exceeds
 * the target size.
 */

export interface TextChunk {
  index: number;
  content: string;
  /** Character offsets into the source text (for source attribution). */
  start: number;
  end: number;
}

export interface ChunkOptions {
  /** Target chunk size in characters. */
  maxChars?: number;
  /** Characters of trailing context repeated at the start of the next chunk. */
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 150;
/** Chunks shorter than this are noise (page numbers, stray headers). */
const MIN_CHUNK_CHARS = 20;

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = Math.min(
    options.overlapChars ?? DEFAULT_OVERLAP_CHARS,
    Math.floor(maxChars / 2),
  );

  const normalized = text.replace(/\r\n/g, '\n');
  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    let end = Math.min(cursor + maxChars, normalized.length);

    if (end < normalized.length) {
      // Prefer the last paragraph break in the window, then a sentence end,
      // then whitespace; hard cut only as a last resort.
      const window = normalized.slice(cursor, end);
      const paragraphBreak = window.lastIndexOf('\n\n');
      const sentenceEnd = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('.\n'),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
      );
      const whitespace = window.lastIndexOf(' ');

      // Only accept a break point past the midpoint so chunks stay near
      // the target size instead of degenerating to tiny fragments.
      const midpoint = Math.floor(maxChars / 2);
      if (paragraphBreak > midpoint) end = cursor + paragraphBreak;
      else if (sentenceEnd > midpoint) end = cursor + sentenceEnd + 1;
      else if (whitespace > midpoint) end = cursor + whitespace;
    }

    const content = normalized.slice(cursor, end).trim();
    if (content.length >= MIN_CHUNK_CHARS) {
      chunks.push({ index: chunks.length, content, start: cursor, end });
    }

    if (end >= normalized.length) break;
    cursor = Math.max(end - overlapChars, cursor + 1);
  }

  return chunks;
}
