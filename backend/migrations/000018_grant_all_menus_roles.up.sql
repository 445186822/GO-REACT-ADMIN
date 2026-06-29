-- Grant every active menu to every active role (including newly created chat:view and role CRUD)
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT r.id, m.id, 'ALL'
FROM sys_roles r
CROSS JOIN sys_menus m
WHERE r.deleted_at IS NULL
  AND r.status = 'ACTIVE'
  AND m.deleted_at IS NULL
  AND m.status = 'ACTIVE'
ON CONFLICT (role_id, menu_id) DO NOTHING;
