-- Permission resolution is pools-only (Role -> RolePermissionPool -> PermissionPool ->
-- PermissionPoolPermission -> Permission). The direct role_permissions join table was
-- never the live resolution path and was a source of ambiguity / a privilege-escalation
-- gap (an endpoint could write to it without clearance validation while it sat unread).
-- Dropping it removes the second, inconsistent path entirely.
DROP TABLE IF EXISTS "roles-permissions"."role_permissions";
