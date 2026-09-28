-- Read-only diagnostics. No archive RPC is executed and no rows are changed.
-- Run in Supabase SQL Editor and export the result of each SELECT.
BEGIN TRANSACTION READ ONLY;

SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS return_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (
    p.proname IN (
      'mone_admin_archive_link_direct_v134',
      'mone_admin_session_valid_v1524',
      'get_room_snapshot_v1523',
      'sogul_compat_v1'
    )
    OR p.proname LIKE 'mone%archive%'
    OR p.proname LIKE 'mone%session%'
    OR p.proname LIKE 'mone%login%'
    OR p.proname LIKE 'mone%compat%'
  )
ORDER BY p.proname, identity_arguments;

-- Schema only: no admin tokens or participant rows are selected.
SELECT table_schema, table_name, ordinal_position, column_name,
       data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'admin_sessions', 'app_admins', 'mone_admin_sessions_v1524',
    'links', 'archive_requests', 'rooms'
  )
ORDER BY table_name, ordinal_position;

ROLLBACK;
