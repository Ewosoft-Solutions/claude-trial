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

// ---- WB3 consolidation: system fields (cascade + repeatable + hidden) ----

const systemDef: FormDefinition = {
  title: 'Application form',
  sections: [
    {
      id: 'sa',
      title: 'Applicant',
      system: true,
      items: [
        {
          id: 'a1',
          key: 'first_name',
          type: 'short_text',
          label: 'First name',
          required: true,
          system: true,
          binding: 'applicant.firstName',
        },
        {
          id: 'a2',
          key: 'religion',
          type: 'short_text',
          label: 'Religion',
          system: true,
          binding: 'applicant.religion',
          hidden: true,
        },
      ],
    },
    {
      id: 'sc',
      title: 'Applying for',
      system: true,
      items: [
        {
          id: 'c1',
          key: 'applying_for',
          type: 'cascade',
          label: 'Class applying for',
          required: true,
          system: true,
          binding: 'applying_for',
        },
      ],
    },
    {
      id: 'sg',
      title: 'Guardians',
      system: true,
      binding: 'guardians',
      repeatable: { min: 1, max: 3, entryNoun: 'guardian' },
      items: [
        {
          id: 'g1',
          key: 'g_first',
          type: 'short_text',
          label: 'Guardian first name',
          required: true,
          system: true,
          binding: 'guardian.firstName',
        },
      ],
    },
  ],
};

const structure = {
  campuses: [{ id: 'cm', name: 'Main' }],
  stages: [{ id: 'st', name: 'Primary' }],
  yearLevels: [{ id: 'yl', name: 'Primary 5', stageId: 'st' }],
  streams: [],
};

describe('FormRenderer — system fields', () => {
  function SystemHarness() {
    const [value, setValue] = React.useState<Record<string, unknown>>({});
    return (
      <FormRenderer
        definition={systemDef}
        value={value}
        onChange={setValue}
        structure={structure}
        flat
      />
    );
  }

  it('renders the cascade pickers and hides a hidden field', () => {
    render(<SystemHarness />);
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Class')).toBeInTheDocument();
    // `religion` is hidden → its label never renders.
    expect(screen.queryByText('Religion')).not.toBeInTheDocument();
  });

  it('adds a repeatable guardian entry', () => {
    render(<SystemHarness />);
    expect(screen.getByText(/guardian 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/guardian 2/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add guardian/i }));
    expect(screen.getByText(/guardian 2/i)).toBeInTheDocument();
  });
});

describe('FormBuilder — system sections are locked', () => {
  it('marks a system section standard and offers hide, not delete/add', () => {
    render(<FormBuilder value={systemDef} onChange={() => {}} />);
    expect(screen.getAllByText(/standard/i).length).toBeGreaterThan(0);
    // A system item exposes a "Hide from the form" toggle instead of delete.
    expect(screen.getAllByText(/hide from the form/i).length).toBeGreaterThan(
      0,
    );
    // No "Add question" on a system section.
    expect(
      screen.queryByRole('button', { name: /add question/i }),
    ).not.toBeInTheDocument();
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
