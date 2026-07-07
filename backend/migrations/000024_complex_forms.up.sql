CREATE TABLE IF NOT EXISTS biz_complex_forms (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    applicant TEXT NOT NULL,
    department TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'PROCUREMENT',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    amount NUMERIC(14, 2) NULL,
    quantity INTEGER NULL,
    score INTEGER NULL,
    progress INTEGER NULL,
    rating INTEGER NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    start_date DATE NULL,
    end_date DATE NULL,
    appointment_time TIME NULL,
    contact_name TEXT NULL,
    contact_phone TEXT NULL,
    contact_email TEXT NULL,
    attachment_url TEXT NULL,
    form_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    remark TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_biz_complex_forms_status ON biz_complex_forms(status);
CREATE INDEX IF NOT EXISTS idx_biz_complex_forms_created_at ON biz_complex_forms(created_at DESC);

WITH business AS (
    SELECT id FROM sys_menus WHERE code = 'business' AND deleted_at IS NULL
),
page AS (
    INSERT INTO sys_menus (parent_id, type, code, name, path, component, icon, sort_order)
    SELECT business.id, 'page', 'complex-form:view', '复杂表单示例', '/business/complex-forms', 'ComplexFormPage', 'FormOutlined', 22
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
seed(parent_code, type, code, name, sort_order) AS (
    VALUES
        ('complex-form:view', 'button', 'complex-form:create', '创建复杂表单', 221),
        ('complex-form:view', 'button', 'complex-form:update', '编辑复杂表单', 222),
        ('complex-form:view', 'button', 'complex-form:delete', '删除复杂表单', 223)
)
INSERT INTO sys_menus (parent_id, type, code, name, sort_order)
SELECT parent.id, seed.type, seed.code, seed.name, seed.sort_order
FROM seed
JOIN sys_menus parent ON parent.code = seed.parent_code AND parent.deleted_at IS NULL
ON CONFLICT (code) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    type = EXCLUDED.type,
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    deleted_at = NULL,
    updated_at = now();

INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT 1, id, 'ALL'
FROM sys_menus
WHERE code IN ('complex-form:view', 'complex-form:create', 'complex-form:update', 'complex-form:delete')
  AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
