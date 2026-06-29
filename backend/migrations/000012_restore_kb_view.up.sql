UPDATE sys_menus
SET type = 'page',
    code = 'kb:view',
    name = U&'\77E5\8BC6\5E93',
    path = '/knowledge-base',
    component = 'KnowledgeBasePage',
    icon = 'BookOutlined',
    status = 'ACTIVE',
    deleted_at = NULL,
    updated_at = now()
WHERE code = 'kb:view';

INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT 1, id, 'ALL'
FROM sys_menus
WHERE code = 'kb:view' AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
