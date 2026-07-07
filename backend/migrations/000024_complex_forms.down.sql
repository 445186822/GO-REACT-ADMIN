DELETE FROM sys_role_menus
WHERE menu_id IN (
    SELECT id FROM sys_menus WHERE code IN ('complex-form:view', 'complex-form:create', 'complex-form:update', 'complex-form:delete')
);

DELETE FROM sys_menus
WHERE code IN ('complex-form:create', 'complex-form:update', 'complex-form:delete', 'complex-form:view');

DROP TABLE IF EXISTS biz_complex_forms;
