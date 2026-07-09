DELETE FROM sys_role_menus
WHERE menu_id IN (SELECT id FROM sys_menus WHERE code IN ('notification:view', 'notification:create'));

UPDATE sys_menus SET deleted_at = now(), updated_at = now()
WHERE code IN ('notification:view', 'notification:create') AND deleted_at IS NULL;
