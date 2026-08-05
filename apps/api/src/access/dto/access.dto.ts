/**
 * DTOs for the WB1-6 access-grant + campus surfaces.
 *
 * The global ValidationPipe runs `whitelist` + `forbidNonWhitelisted`, so every
 * accepted property MUST carry a class-validator decorator or the request 400s
 * before the handler. `stepUpChallengeId` is consumed + stripped by StepUpGuard
 * (before validation), so it is not declared here.
 */
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** The scope a grant (or campus target) is bound to. */
export class ScopeDescriptorDto {
  @IsIn(['campus', 'global'])
  type: 'campus' | 'global';

  /** For `campus`: the campusId. Omitted/ignored for `global`. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

/**
 * Request a role grant for a profile — optionally scoped to a campus and/or
 * time-boxed. A high-risk role routes to maker-checker; a low-risk one applies
 * immediately.
 */
export class RequestGrantDto {
  /** The profile (UserTenant id) receiving the role. */
  @IsString()
  @MaxLength(64)
  profileId: string;

  /** The role to grant. */
  @IsString()
  @MaxLength(64)
  roleId: string;

  /** Optional campus/global scope. Absent = unscoped (global). */
  @IsOptional()
  scope?: ScopeDescriptorDto | null;

  /** ISO-8601 expiry for a temporary cover. Absent = permanent. */
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  /** Why the grant is made (recorded on the grant + audit). */
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

/** Approve or reject a pending high-risk grant request (the checker). */
export class ReviewGrantDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class CreateCampusDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateCampusDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
