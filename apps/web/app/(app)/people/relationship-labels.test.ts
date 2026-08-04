import { describe, expect, it } from 'vitest';

import { guardianRoleLabel, wardRoleLabel } from './person-detail.types';

describe('directional caregiver labels', () => {
  it('guardianRoleLabel names the GUARDIAN role (ward-page perspective)', () => {
    expect(guardianRoleLabel('parent')).toBe('Parent');
    expect(guardianRoleLabel('grandparent')).toBe('Grandparent');
    expect(guardianRoleLabel('guardian')).toBe('Guardian');
  });

  it('wardRoleLabel INVERTS to the ward role (guardian-page perspective)', () => {
    // "Multi is the parent" → on Multi's page the ward is a "Child".
    expect(wardRoleLabel('parent')).toBe('Child');
    expect(wardRoleLabel('mother')).toBe('Child');
    expect(wardRoleLabel('father')).toBe('Child');
    expect(wardRoleLabel('grandparent')).toBe('Grandchild');
    expect(wardRoleLabel('guardian')).toBe('Ward');
    expect(wardRoleLabel('caregiver')).toBe('Dependent');
    expect(wardRoleLabel('foster_parent')).toBe('Foster child');
    expect(wardRoleLabel('sibling')).toBe('Sibling');
  });

  it('caregiver (non-kin, e.g. a househelp) is a first-class relationship', () => {
    expect(guardianRoleLabel('caregiver')).toBe('Caregiver');
  });

  it('unknown kinships fall back sensibly', () => {
    expect(guardianRoleLabel('weird_value')).toBe('Weird value'); // humanised
    expect(wardRoleLabel('weird_value')).toBe('Ward'); // they are a ward
  });
});
