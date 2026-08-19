import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dot, Separated } from './dot';

describe('Dot', () => {
  it('is hidden from assistive tech — it is punctuation, not content', () => {
    const { container } = render(<Dot />);
    const dot = container.querySelector('[data-slot="dot"]');
    expect(dot).toHaveAttribute('aria-hidden');
    // no text node: a screen reader reading the line hears the facts only
    expect(dot?.textContent).toBe('');
  });

  it('takes its colour from the surrounding text', () => {
    const { container } = render(<Dot />);
    // bg-current, so a muted caption and a full-contrast line both work
    // without a per-context override
    expect(container.querySelector('[data-slot="dot"]')?.className).toContain(
      'bg-current',
    );
  });
});

describe('Separated', () => {
  it('renders each part with a dot between, and none before the first', () => {
    // the parts are bare text nodes, not wrapped elements, so assert on the
    // rendered text rather than looking for an element that equals a part
    const { container } = render(<Separated text="Student · P5" />);
    expect(container.textContent).toBe('StudentP5');
    expect(container.querySelectorAll('[data-slot="dot"]')).toHaveLength(1);
    // the dot sits BETWEEN the parts, never leading
    expect(container.firstChild?.textContent).toBe('Student');
  });

  it('drops empty parts so a filtered join needs no guard', () => {
    // `['a', null, 'c'].filter(Boolean).join(' · ')` can still leave a stray
    // separator when a part is an empty string rather than null
    const { container } = render(<Separated text="a ·  · c" />);
    expect(container.querySelectorAll('[data-slot="dot"]')).toHaveLength(1);
  });

  it('renders a single part with no separator at all', () => {
    const { container } = render(<Separated text="Student" />);
    expect(container.textContent).toBe('Student');
    expect(container.querySelectorAll('[data-slot="dot"]')).toHaveLength(0);
  });

  it('reads as the facts alone, without the mark', () => {
    const { container } = render(<Separated text="Invoice · Paid" />);
    // aria-hidden dots contribute nothing, so the accessible text is the parts
    expect(container.textContent).toBe('InvoicePaid');
  });
});
