import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';

import type { FormDefinition } from '@workspace/forms';
import { FormRenderer } from './form-renderer';
import { FormBuilder } from './form-builder';

// s1 flows to s2 by default; picking JSS branches straight to Submit.
const def: FormDefinition = {
  title: 'Intake',
  settings: { progressBar: true },
  sections: [
    {
      id: 's1',
      title: 'About you',
      items: [
        {
          id: 'i1',
          key: 'name',
          type: 'short_text',
          label: 'Name',
          required: true,
        },
        {
          id: 'i2',
          key: 'level',
          type: 'radio',
          label: 'Level',
          options: ['JSS', 'SSS'],
          required: true,
          branching: [{ answer: 'JSS', goTo: 'submit' }],
        },
      ],
    },
    {
      id: 's2',
      title: 'Senior details',
      items: [{ id: 'i3', key: 'stream', type: 'short_text', label: 'Stream' }],
    },
  ],
};

function Harness({
  onSubmit,
}: {
  onSubmit?: (a: Record<string, unknown>) => void;
}) {
  const [value, setValue] = React.useState<Record<string, unknown>>({});
  return (
    <FormRenderer
      definition={def}
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
    />
  );
}

describe('FormRenderer', () => {
  it('blocks Next on a missing required field, then branches to the senior section for SSS', () => {
    render(<Harness />);
    expect(screen.getByText('About you')).toBeInTheDocument();

    // Nothing filled → required error, still on section one.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/required/i)).toBeInTheDocument();
    expect(screen.queryByText('Senior details')).toBeNull();

    // Fill name + pick SSS (no branch) → advances to s2.
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByLabelText('SSS'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Senior details')).toBeInTheDocument();
    expect(screen.getByLabelText(/Stream/)).toBeInTheDocument();
  });

  it('submits from the first section when JSS branches to submit', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByLabelText('JSS'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ada', level: 'JSS' }),
    );
  });
});

describe('FormBuilder', () => {
  it('adds a section', () => {
    function BuilderHarness() {
      const [d, setD] = React.useState<FormDefinition>({
        title: 'X',
        sections: [{ id: 's1', title: '', items: [] }],
      });
      return <FormBuilder value={d} onChange={setD} />;
    }
    render(<BuilderHarness />);
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add section/i }));
    expect(screen.getByText('Section 2')).toBeInTheDocument();
  });
});
