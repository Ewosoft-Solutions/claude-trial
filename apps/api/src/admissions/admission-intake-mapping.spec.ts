/**
 * WB3 consolidation — the SYSTEM (bound) form fields map onto the SAME structured
 * intake payload `createApplication` already accepts, and the new form-engine
 * types (cascade + repeatable Guardians + hidden) validate correctly.
 */
import { describe, it, expect } from '@jest/globals';
import {
  BINDINGS,
  answersToCreateApplicationInput,
  validateAnswers,
  FormValidationError,
  type FormDefinition,
} from '@workspace/forms';

/** A minimal standard intake form: Applicant + Applying-for (cascade) + Guardians. */
function intakeForm(): FormDefinition {
  return {
    title: 'Application form',
    sections: [
      {
        id: 's-applicant',
        title: 'Applicant',
        system: true,
        items: [
          { id: 'i1', key: 'first_name', type: 'short_text', label: 'First name', required: true, system: true, binding: BINDINGS.firstName },
          { id: 'i2', key: 'surname', type: 'short_text', label: 'Surname', required: true, system: true, binding: BINDINGS.surname },
          { id: 'i3', key: 'gender', type: 'dropdown', label: 'Gender', options: ['male', 'female', 'other'], system: true, binding: BINDINGS.gender },
          { id: 'i4', key: 'religion', type: 'short_text', label: 'Religion', system: true, binding: BINDINGS.religion, hidden: true },
        ],
      },
      {
        id: 's-class',
        title: 'Applying for',
        system: true,
        items: [
          { id: 'c1', key: 'applying_for', type: 'cascade', label: 'Class applying for', required: true, system: true, binding: BINDINGS.applyingFor },
        ],
      },
      {
        id: 's-guardians',
        title: 'Guardians',
        system: true,
        binding: BINDINGS.guardians,
        repeatable: { min: 1, max: 4, entryNoun: 'guardian' },
        items: [
          { id: 'g1', key: 'g_first', type: 'short_text', label: 'First name', required: true, system: true, binding: BINDINGS.guardianFirstName },
          { id: 'g2', key: 'g_surname', type: 'short_text', label: 'Surname', required: true, system: true, binding: BINDINGS.guardianSurname },
          { id: 'g3', key: 'g_rel', type: 'dropdown', label: 'Relationship', options: ['mother', 'father', 'guardian'], required: true, system: true, binding: BINDINGS.guardianRelationship },
          { id: 'g4', key: 'g_phone', type: 'phone', label: 'Phone', required: true, system: true, binding: BINDINGS.guardianPhone },
        ],
      },
    ],
  };
}

describe('answersToCreateApplicationInput (WB3 consolidation)', () => {
  it('maps bound answers + cascade + guardians onto the structured payload', () => {
    const def = intakeForm();
    const answers = {
      first_name: 'Ada',
      surname: 'Okoro',
      gender: 'female',
      applying_for: { yearLevelId: 'yl_p5', stageId: 'st_pri' },
      [BINDINGS.guardians]: [
        {
          g_first: 'Ebele',
          g_surname: 'Okoro',
          g_rel: 'mother',
          g_phone: { dialCode: '+234', number: '8012345678' },
        },
      ],
    };

    const dto = answersToCreateApplicationInput(def, answers);
    expect(dto.applicantFirstName).toBe('Ada');
    expect(dto.applicantSurname).toBe('Okoro');
    expect(dto.gender).toBe('female');
    expect(dto.yearLevelId).toBe('yl_p5');
    expect(dto.stageId).toBe('st_pri');
    expect(dto.guardians).toHaveLength(1);
    expect(dto.guardians[0]).toMatchObject({
      firstName: 'Ebele',
      surname: 'Okoro',
      relationship: 'mother',
      phoneCountryCode: '+234',
      phoneNumber: '8012345678',
      isPrimary: true,
    });
  });

  it('forces exactly one primary — the first guardian', () => {
    const def = intakeForm();
    const answers = {
      first_name: 'A',
      surname: 'B',
      applying_for: { yearLevelId: 'yl' },
      [BINDINGS.guardians]: [
        { g_first: 'One', g_surname: 'P', g_rel: 'mother', g_phone: { number: '111' } },
        { g_first: 'Two', g_surname: 'Q', g_rel: 'father', g_phone: { number: '222' } },
      ],
    };
    const dto = answersToCreateApplicationInput(def, answers);
    expect(dto.guardians.map((g) => g.isPrimary)).toEqual([true, false]);
  });
});

describe('validateAnswers with the new types', () => {
  const valid = {
    first_name: 'Ada',
    surname: 'Okoro',
    applying_for: { yearLevelId: 'yl_p5' },
    [BINDINGS.guardians]: [
      { g_first: 'Ebele', g_surname: 'Okoro', g_rel: 'mother', g_phone: { number: '8012345678' } },
    ],
  };

  it('accepts a well-formed submission', () => {
    expect(() => validateAnswers(intakeForm(), valid)).not.toThrow();
  });

  it('requires the cascade to carry a class', () => {
    expect(() =>
      validateAnswers(intakeForm(), { ...valid, applying_for: { stageId: 'x' } }),
    ).toThrow(FormValidationError);
  });

  it('enforces the repeatable minimum (at least one guardian)', () => {
    expect(() =>
      validateAnswers(intakeForm(), { ...valid, [BINDINGS.guardians]: [] }),
    ).toThrow(FormValidationError);
  });

  it('never demands a hidden field', () => {
    // `religion` is hidden → omitting it is fine even though it is a system field.
    expect(() => validateAnswers(intakeForm(), valid)).not.toThrow();
  });
});
