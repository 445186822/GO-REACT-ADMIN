WITH business AS (
    SELECT id FROM sys_menus WHERE code = 'business' AND deleted_at IS NULL
),
page_menu AS (
    INSERT INTO sys_menus (parent_id, type, code, name, path, component, icon, sort_order)
    SELECT business.id, 'page', 'code-generator:view', '快速生成代码', '/business/code-generator', 'CodeGeneratorPage', 'CodeOutlined', 23
    FROM business
    ON CONFLICT (code) DO UPDATE
    SET parent_id = EXCLUDED.parent_id,
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        path = EXCLUDED.path,
        component = EXCLUDED.component,
        icon = EXCLUDED.icon,
        sort_order = EXCLUDED.sort_order,
        deleted_at = NULL,
        updated_at = now()
    RETURNING id
),
button_menu AS (
    INSERT INTO sys_menus (parent_id, type, code, name, sort_order)
    SELECT page_menu.id, 'button', 'code-generator:create', '生成代码', 231
    FROM page_menu
    ON CONFLICT (code) DO UPDATE
    SET parent_id = EXCLUDED.parent_id,
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        deleted_at = NULL,
        updated_at = now()
    RETURNING id
)
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT r.id, m.id, 'ALL'
FROM sys_roles r
CROSS JOIN sys_menus m
WHERE r.code = 'ADMIN'
  AND m.code IN ('code-generator:view', 'code-generator:create')
ON CONFLICT DO NOTHING;
