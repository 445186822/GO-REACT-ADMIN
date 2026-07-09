DELETE FROM sys_role_menus
WHERE menu_id IN (
    SELECT id FROM sys_menus WHERE code IN ('code-generator:view', 'code-generator:create')
);

DELETE FROM sys_menus
WHERE code IN ('code-generator:create', 'code-generator:view');
