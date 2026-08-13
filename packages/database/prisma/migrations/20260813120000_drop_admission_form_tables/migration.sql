-- Drop the orphaned WB3-3 admissions form tables.
--
-- These were superseded by the generic Form engine (forms.forms /
-- forms.form_versions / forms.form_responses; PR #105-#108). Admissions now
-- stores its application form + responses there (a Form with purpose
-- 'admissions.application', responses with subject 'AdmissionApplication'), and
-- no application code references these tables any more. They were left in place
-- during the P4 rewire to avoid a destructive migration mid-change.
--
-- DROP ... CASCADE removes each table's indexes, FK constraints, RLS policies and
-- role grants along with it. The responses table is dropped first (it FKs the
-- versions table); IF EXISTS + CASCADE keep this idempotent and order-safe. The
-- admission_interviews table created by the same original migration is NOT
-- touched — it is still in use.

DROP TABLE IF EXISTS "admissions"."admission_form_responses" CASCADE;
DROP TABLE IF EXISTS "admissions"."admission_form_versions" CASCADE;
