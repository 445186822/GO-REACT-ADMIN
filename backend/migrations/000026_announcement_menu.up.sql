-- Add announcement menu under the collaboration parent
WITH collaboration_parent AS (
    SELECT id FROM sys_menus WHERE code = 'collaboration'
),
announcement_menu AS (
    INSERT INTO sys_menus (parent_id, type, code, name, path, component, icon, sort_order)
    SELECT id, 'page', 'notification:view', '公告中心', '/collaboration/announcements', 'AnnouncementCenterPage', 'BellOutlined', 10
    FROM collaboration_parent
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
create_button AS (
    INSERT INTO sys_menus (parent_id, type, code, name, sort_order)
    SELECT announcement_menu.id, 'button', 'notification:create', '创建公告', 101
    FROM announcement_menu
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
  AND m.code IN ('notification:view', 'notification:create')
ON CONFLICT DO NOTHING;
