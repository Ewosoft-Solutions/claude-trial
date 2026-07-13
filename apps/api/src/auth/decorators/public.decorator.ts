import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key marking a route as public (no authentication required).
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route handler (or controller) as public.
 *
 * Guards that authenticate/authorize (JwtAuthGuard, ClearanceLevelGuard)
 * honor this and skip their checks, so a single method on an otherwise
 * class-guarded controller can be reached without a token. Used for
 * genuinely unauthenticated endpoints such as invitation acceptance, where
 * the caller has no account yet.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
