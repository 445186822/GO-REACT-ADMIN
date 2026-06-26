WITH parent AS (
    INSERT INTO sys_menus (type, code, name, path, component, icon, sort_order)
    VALUES ('directory', 'knowledge', '知识库', NULL, NULL, 'ReadOutlined', 40)
    ON CONFLICT (code) DO UPDATE
    SET type = EXCLUDED.type,
        name = EXCLUDED.name,
        path = EXCLUDED.path,
        component = EXCLUDED.component,
        icon = EXCLUDED.icon,
        sort_order = EXCLUDED.sort_order,
        deleted_at = NULL,
        updated_at = now()
    RETURNING id
),
seed(code, name, path, component, icon, sort_order) AS (
    VALUES
        ('kb:article:view', '文章管理', '/knowledge-base/articles', 'KnowledgeArticlesPage', 'BookOutlined', 41),
        ('kb:faq:view', 'FAQ管理', '/knowledge-base/faqs', 'KnowledgeFAQPage', 'ReadOutlined', 42),
        ('kb:category:view', '分类管理', '/knowledge-base/categories', 'KnowledgeCategoriesPage', 'FolderOutlined', 43)
),
upserted AS (
    INSERT INTO sys_menus (parent_id, type, code, name, path, component, icon, sort_order)
    SELECT parent.id, 'page', seed.code, seed.name, seed.path, seed.component, seed.icon, seed.sort_order
    FROM seed CROSS JOIN parent
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
)
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT 1, id, 'ALL'
FROM upserted
ON CONFLICT DO NOTHING;

UPDATE sys_menus
SET deleted_at = now(), updated_at = now()
WHERE code = 'kb:view' AND deleted_at IS NULL;
