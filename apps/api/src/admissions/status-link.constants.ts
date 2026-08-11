/**
 * The applicant status-portal SecureLink contract — shared so both the public
 * self-submit (PublicAdmissionsService) and the staff "send portal link" action
 * (AdmissionsService.createStatusLink) mint + resolve the same kind of token.
 */
export const STATUS_PURPOSE = 'admission_status';
export const STATUS_TARGET = 'admission_application';
/** A status link lives for one admission cycle (~6 months). */
export const STATUS_TTL_SECONDS = 180 * 24 * 60 * 60;
