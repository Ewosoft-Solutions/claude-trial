import { chunkText } from './chunking';

describe('chunkText', () => {
  it('returns no chunks for empty or trivial text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n  ')).toEqual([]);
    expect(chunkText('too short')).toEqual([]); // below MIN_CHUNK_CHARS
  });

  it('returns a single chunk for text under the target size', () => {
    const text = 'Photosynthesis converts light energy into chemical energy.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, content: text });
  });

  it('splits long text into overlapping chunks', () => {
    const paragraph =
      'The Calvin cycle fixes carbon dioxide into sugar molecules. '.repeat(10);
    const text = Array.from({ length: 6 }, () => paragraph).join('\n\n');
    const chunks = chunkText(text, { maxChars: 500, overlapChars: 100 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(500);
    }
    // Overlap: each next chunk starts before the previous one ended.
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].start).toBeLessThan(chunks[i - 1].end);
      expect(chunks[i].start).toBeGreaterThan(chunks[i - 1].start);
    }
    // Sequential indexes.
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it('prefers paragraph boundaries over hard cuts', () => {
    const first = 'First paragraph with plenty of words inside it. '.repeat(8);
    const second = 'Second paragraph, distinct content here. '.repeat(8);
    const chunks = chunkText(`${first.trim()}\n\n${second.trim()}`, {
      maxChars: first.length + 60,
    });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // The first chunk should end at the paragraph break, not mid-sentence
    // of the second paragraph.
    expect(chunks[0].content.endsWith(first.trim().slice(-20))).toBe(true);
    expect(chunks[0].content).not.toContain('Second paragraph');
  });
});
