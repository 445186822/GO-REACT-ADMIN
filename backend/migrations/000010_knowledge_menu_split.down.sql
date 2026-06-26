DELETE FROM sys_role_menus
WHERE menu_id IN (
    SELECT id FROM sys_menus WHERE code IN ('kb:article:view', 'kb:faq:view', 'kb:category:view')
);

DELETE FROM sys_menus
WHERE code IN ('kb:article:view', 'kb:faq:view', 'kb:category:view');

UPDATE sys_menus
SET deleted_at = NULL, updated_at = now()
WHERE code = 'kb:view';
