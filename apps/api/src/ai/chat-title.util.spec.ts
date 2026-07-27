import { deriveSessionTitle, extractSessionTitle } from './chat-title.util';

describe('extractSessionTitle', () => {
  it('pulls a trailing #title line and strips it from the body', () => {
    const { title, body } = extractSessionTitle(
      'There are 420 active students.\n\n#title: Active student count',
    );
    expect(title).toBe('Active student count');
    expect(body).toBe('There are 420 active students.');
  });

  it('handles a title after a chart block, case-insensitively', () => {
    const raw =
      'Attendance is trending up.\n```chart\n{"type":"trend"}\n```\n#TITLE: Attendance trend';
    const { title, body } = extractSessionTitle(raw);
    expect(title).toBe('Attendance trend');
    expect(body).toContain('```chart');
    expect(body).not.toContain('#TITLE');
  });

  it('returns null + the original text when no title line is present', () => {
    const raw = 'Just a plain answer with no title.';
    const { title, body } = extractSessionTitle(raw);
    expect(title).toBeNull();
    expect(body).toBe(raw);
  });
});

describe('deriveSessionTitle', () => {
  it('collapses whitespace and drops trailing punctuation', () => {
    expect(deriveSessionTitle('How   many\nstudents are enrolled?')).toBe(
      'How many students are enrolled',
    );
  });

  it('takes the first sentence of a multi-sentence message', () => {
    expect(
      deriveSessionTitle('Summarize attendance this term. Then compare terms.'),
    ).toBe('Summarize attendance this term');
  });

  it('caps overly long titles at a word boundary with an ellipsis', () => {
    const long =
      'Please give me an extremely detailed breakdown of every single fee line item for the whole year';
    const title = deriveSessionTitle(long);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/); // no dangling space before the ellipsis
    // The kept text is a whole-word prefix of the original (no cut-off word).
    expect(long.startsWith(title.replace('…', ''))).toBe(true);
  });

  it('falls back to a placeholder for empty input', () => {
    expect(deriveSessionTitle('   ')).toBe('New conversation');
  });
});
