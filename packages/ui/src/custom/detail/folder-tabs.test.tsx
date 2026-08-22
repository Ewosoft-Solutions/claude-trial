import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  FolderTabButtons,
  FolderTabs,
  FolderTabsContent,
  FolderTabsList,
  FolderTabsTrigger,
} from './folder-tabs';
// Imported from the shape module, the way a SERVER component must import it:
// through `folder-tabs` it crosses the client boundary and its function props
// stop being serialisable.
import { FolderTabLinks } from './folder-tab-shape';

type Tab = 'overview' | 'finance' | 'documents';
const TABS: Tab[] = ['overview', 'finance', 'documents'];
const label = (t: Tab) => t[0]!.toUpperCase() + t.slice(1);

/** The joins are the selection: decorative SVGs only the active tab carries. */
function joinCount(el: HTMLElement) {
  return el.querySelectorAll('svg').length;
}

describe('FolderTabLinks', () => {
  const Anchor = (props: React.ComponentProps<'a'>) => <a {...props} />;

  it('renders one link per tab, pointing at its route', () => {
    render(
      <FolderTabLinks
        tabs={TABS}
        activeTab="finance"
        href={(t) => `/people/p1/${t}`}
        label={label}
        as={Anchor}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute(
      'href',
      '/people/p1/documents',
    );
  });

  it('marks only the active tab, for shape AND for assistive tech', () => {
    render(
      <FolderTabLinks
        tabs={TABS}
        activeTab="finance"
        href={(t) => `/x/${t}`}
        label={label}
        as={Anchor}
      />,
    );
    const active = screen.getByRole('link', { name: 'Finance' });
    const other = screen.getByRole('link', { name: 'Overview' });

    expect(active).toHaveAttribute('aria-current', 'page');
    expect(other).not.toHaveAttribute('aria-current');
    // Two joins (left + right) on the active tab, none on the others.
    expect(joinCount(active)).toBe(2);
    expect(joinCount(other)).toBe(0);
  });

  it('stays out of the way when there is nothing to switch between', () => {
    const { container } = render(
      <FolderTabLinks
        tabs={['overview'] as Tab[]}
        activeTab="overview"
        href={(t) => `/x/${t}`}
        label={label}
        as={Anchor}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FolderTabButtons', () => {
  it('reports the chosen tab', () => {
    const onChange = vi.fn();
    render(
      <FolderTabButtons
        tabs={TABS}
        value="overview"
        onChange={onChange}
        label={label}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    expect(onChange).toHaveBeenCalledWith('finance');
  });

  it('carries the selection on the active button only', () => {
    render(
      <FolderTabButtons
        tabs={TABS}
        value="documents"
        onChange={() => {}}
        label={label}
      />,
    );
    expect(joinCount(screen.getByRole('button', { name: 'Documents' }))).toBe(
      2,
    );
    expect(joinCount(screen.getByRole('button', { name: 'Overview' }))).toBe(0);
  });
});

describe('FolderTabsList / Trigger (Radix-backed)', () => {
  function Fixture({ ground }: { ground?: 'card' } = {}) {
    return (
      <FolderTabs defaultValue="overview">
        <FolderTabsList ground={ground}>
          {TABS.map((t) => (
            <FolderTabsTrigger key={t} value={t}>
              {label(t)}
            </FolderTabsTrigger>
          ))}
        </FolderTabsList>
        {TABS.map((t) => (
          <FolderTabsContent key={t} value={t}>
            {t} panel
          </FolderTabsContent>
        ))}
      </FolderTabs>
    );
  }

  it('keeps Radix tab semantics and switches panels', () => {
    render(<Fixture />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('overview panel');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Finance' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Finance' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('finance panel');
  });

  it('mounts joins on every trigger and lets state reveal them', () => {
    render(<Fixture />);
    // Radix owns which tab is active, so the joins are always in the DOM and
    // CSS shows them for `data-state=active` — assert the hook, not the paint.
    for (const t of TABS) {
      expect(joinCount(screen.getByRole('tab', { name: label(t) }))).toBe(2);
    }
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  it('paints on the ground it was told it sits on', () => {
    // The ground rides on the outer scroll container — the element that also
    // paints the rule — so the tabs and their joins inherit one value.
    const strip = () =>
      screen.getByRole('tablist').parentElement as HTMLElement;

    const { rerender } = render(<Fixture />);
    expect(strip().style.getPropertyValue('--tab-ground')).toBe(
      'var(--background)',
    );

    rerender(<Fixture ground="card" />);
    expect(strip().style.getPropertyValue('--tab-ground')).toBe('var(--card)');
  });
});
