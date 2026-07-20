-- Tenant-isolation proof for the RLS policies.
-- Runs entirely in a transaction and ROLLS BACK — leaves no data behind.
-- Seeds one announcement per tenant (as the owner/superuser, which bypasses
-- RLS), then exercises the policies as the restricted `app_runtime` role.
--
-- Usage:
--   psql "$DATABASE_URL" \
--     -v ta=<tenantA-uuid> -v tb=<tenantB-uuid> \
--     -f packages/database/prisma/scripts/rls-isolation-check.sql
--
-- Expected: A sees only PROOF-A; B sees only PROOF-B; no context sees 0;
-- a cross-tenant INSERT is rejected (WITH CHECK); a cross-tenant UPDATE
-- affects 0 rows; platform bypass sees both.

\set ON_ERROR_ROLLBACK on
\set ON_ERROR_STOP off

BEGIN;

INSERT INTO communication.announcements (id, tenant_id, target_type, title, content, created_at, updated_at)
VALUES (gen_random_uuid(), :'ta', 'all', 'PROOF-A', 'x', now(), now()),
       (gen_random_uuid(), :'tb', 'all', 'PROOF-B', 'y', now(), now());

SET ROLE app_runtime;

\echo '=== [1] as tenant A — expect ONLY PROOF-A ==='
SELECT set_config('app.current_tenant_id', :'ta', true);
SELECT title FROM communication.announcements WHERE title LIKE 'PROOF-%' ORDER BY title;

\echo '=== [2] as tenant B — expect ONLY PROOF-B ==='
SELECT set_config('app.current_tenant_id', :'tb', true);
SELECT title FROM communication.announcements WHERE title LIKE 'PROOF-%' ORDER BY title;

\echo '=== [3] no tenant context — expect 0 visible ==='
SELECT set_config('app.current_tenant_id', '', true);
SELECT count(*) AS visible FROM communication.announcements WHERE title LIKE 'PROOF-%';

\echo '=== [4] WITH CHECK — as A, inserting a B-owned row must ERROR ==='
SELECT set_config('app.current_tenant_id', :'ta', true);
INSERT INTO communication.announcements (id, tenant_id, target_type, title, content)
VALUES (gen_random_uuid(), :'tb', 'all', 'PROOF-EVIL', 'z');

\echo '=== [5] cross-tenant UPDATE — as A, updating B''s row must affect 0 rows ==='
UPDATE communication.announcements SET content = 'hacked' WHERE title = 'PROOF-B';

\echo '=== [6] cross-tenant DELETE — as A, deleting B''s row must affect 0 rows ==='
DELETE FROM communication.announcements WHERE title = 'PROOF-B';

\echo '=== [7] platform bypass — app.is_platform=on — expect BOTH ==='
SELECT set_config('app.is_platform', 'on', true);
SELECT title FROM communication.announcements WHERE title LIKE 'PROOF-%' ORDER BY title;
SELECT set_config('app.is_platform', '', true);

RESET ROLE;
ROLLBACK;
