import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Guardianship DTOs (WB1-4). Model real caregiver relationships beyond the
 * legacy Father/Mother/Both gender label (C049): authority (custody, pickup,
 * medical, emergency, billing), per-category contact consent, and verification.
 */

/**
 * The caregiver relationship to the ward — a closed list so the data stays
 * clean and reportable (no free-text ambiguity). Kinship label only; legal
 * authority is the separate `legalGuardian` flag. Keep in step with the web
 * `RELATIONSHIPS` list in guardianship-panel.tsx.
 */
export const RELATIONSHIP_TYPES = [
  'mother',
  'father',
  'parent',
  'step_parent',
  'grandparent',
  'sibling',
  'aunt_uncle',
  'cousin',
  'guardian',
  // A non-kin engaged caregiver (e.g. a househelp / nanny) who collects the
  // child — registered as a Person, typically with canPickup + a photo, and a
  // future check-in/out attendance identity (see the attendance-system note).
  'caregiver',
  'foster_parent',
  'other_relative',
  'other',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const CUSTODY_TYPES = [
  'full',
  'joint',
  'partial',
  'none',
  'visitation',
] as const;

export const VERIFICATION_METHODS = [
  'document',
  'in_person',
  'id_check',
  'existing_record',
] as const;

/** Comms categories a guardian's consent is expressed per. `emergency` always
 * reaches an emergency contact regardless of the per-category consent flags. */
export const CONSENT_CATEGORIES = [
  'results',
  'finance',
  'attendance',
  'general',
  'emergency',
] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

/** Fields shared by create + update (all optional on update). */
class GuardianshipAuthorityFields {
  @ApiPropertyOptional({ enum: RELATIONSHIP_TYPES, example: 'parent' })
  @IsOptional()
  @IsIn(RELATIONSHIP_TYPES)
  relationship?: RelationshipType;

  @ApiPropertyOptional({ description: 'Primary caregiver for the ward' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Recognised legal guardian' })
  @IsOptional()
  @IsBoolean()
  legalGuardian?: boolean;

  @ApiPropertyOptional({ enum: CUSTODY_TYPES })
  @IsOptional()
  @IsIn(CUSTODY_TYPES)
  custodyType?: (typeof CUSTODY_TYPES)[number];

  @ApiPropertyOptional({ description: 'May collect the child' })
  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;

  @ApiPropertyOptional({ description: 'May authorise medical treatment' })
  @IsOptional()
  @IsBoolean()
  canAuthorizeMedical?: boolean;

  @ApiPropertyOptional({
    description: 'Reachable for emergencies regardless of consent',
  })
  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;

  @ApiPropertyOptional({ description: 'Receives/authorises fee matters' })
  @IsOptional()
  @IsBoolean()
  isBillingContact?: boolean;

  @ApiPropertyOptional({ description: 'Consent to academic result comms' })
  @IsOptional()
  @IsBoolean()
  consentResults?: boolean;

  @ApiPropertyOptional({ description: 'Consent to fee/finance comms' })
  @IsOptional()
  @IsBoolean()
  consentFinance?: boolean;

  @ApiPropertyOptional({ description: 'Consent to attendance/behaviour comms' })
  @IsOptional()
  @IsBoolean()
  consentAttendance?: boolean;

  @ApiPropertyOptional({ description: 'Consent to general announcements' })
  @IsOptional()
  @IsBoolean()
  consentGeneral?: boolean;
}

export class CreateGuardianshipDto extends GuardianshipAuthorityFields {
  @ApiProperty({ description: 'The guardian (caregiver) Person id' })
  @IsUUID()
  guardianPersonId: string;

  @ApiProperty({ description: 'The ward (student) Person id' })
  @IsUUID()
  wardPersonId: string;
}

export class UpdateGuardianshipDto extends GuardianshipAuthorityFields {}

export class VerifyGuardianshipDto {
  @ApiProperty({ enum: VERIFICATION_METHODS })
  @IsIn(VERIFICATION_METHODS)
  method: (typeof VERIFICATION_METHODS)[number];
}

export class EndGuardianshipDto {
  @ApiPropertyOptional({ example: 'Custody transferred' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class ListGuardianshipsQueryDto {
  @ApiPropertyOptional({ description: 'List guardians of this ward Person' })
  @IsOptional()
  @IsUUID()
  wardPersonId?: string;

  @ApiPropertyOptional({ description: 'List wards of this guardian Person' })
  @IsOptional()
  @IsUUID()
  guardianPersonId?: string;

  @ApiPropertyOptional({ description: 'Include ended relationships' })
  @IsOptional()
  @IsString()
  includeEnded?: string;
}

export class GuardianAudienceQueryDto {
  @ApiProperty({ description: 'The ward (student) Person id' })
  @IsUUID()
  wardPersonId: string;

  @ApiProperty({ enum: CONSENT_CATEGORIES })
  @IsIn(CONSENT_CATEGORIES)
  category: ConsentCategory;
}
