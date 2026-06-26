CREATE TABLE IF NOT EXISTS sys_dict_types (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    remark TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sys_dict_items (
    id BIGSERIAL PRIMARY KEY,
    type_id BIGINT NOT NULL REFERENCES sys_dict_types(id),
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    remark TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dict_items_type ON sys_dict_items(type_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dict_items_type_value ON sys_dict_items(type_id, value);

-- Seed common dictionary types
INSERT INTO sys_dict_types (code, name, status, sort_order) VALUES
('GENDER', '性别', 'ENABLED', 1),
('USER_STATUS', '用户状态', 'ENABLED', 2),
('NOTIFICATION_TYPE', '通知类型', 'ENABLED', 3),
('APPROVAL_STATUS', '审批状态', 'ENABLED', 4)
ON CONFLICT (code) DO NOTHING;

-- Seed dictionary items
DO $$
DECLARE
    v_gender_id BIGINT;
    v_user_status_id BIGINT;
    v_notif_id BIGINT;
    v_approval_id BIGINT;
BEGIN
    SELECT id INTO v_gender_id FROM sys_dict_types WHERE code = 'GENDER';
    SELECT id INTO v_user_status_id FROM sys_dict_types WHERE code = 'USER_STATUS';
    SELECT id INTO v_notif_id FROM sys_dict_types WHERE code = 'NOTIFICATION_TYPE';
    SELECT id INTO v_approval_id FROM sys_dict_types WHERE code = 'APPROVAL_STATUS';

    -- Gender
    INSERT INTO sys_dict_items (type_id, label, value, sort_order) VALUES
    (v_gender_id, '男', 'MALE', 1),
    (v_gender_id, '女', 'FEMALE', 2),
    (v_gender_id, '未知', 'UNKNOWN', 3)
    ON CONFLICT (type_id, value) DO NOTHING;

    -- User Status
    INSERT INTO sys_dict_items (type_id, label, value, sort_order) VALUES
    (v_user_status_id, '启用', 'ACTIVE', 1),
    (v_user_status_id, '停用', 'DISABLED', 2)
    ON CONFLICT (type_id, value) DO NOTHING;

    -- Notification Type
    INSERT INTO sys_dict_items (type_id, label, value, sort_order) VALUES
    (v_notif_id, '系统通知', 'SYSTEM', 1),
    (v_notif_id, '业务通知', 'BUSINESS', 2),
    (v_notif_id, '审批通知', 'APPROVAL', 3),
    (v_notif_id, '公告', 'ANNOUNCEMENT', 4)
    ON CONFLICT (type_id, value) DO NOTHING;

    -- Approval Status
    INSERT INTO sys_dict_items (type_id, label, value, sort_order) VALUES
    (v_approval_id, '待审批', 'PENDING', 1),
    (v_approval_id, '已通过', 'APPROVED', 2),
    (v_approval_id, '已驳回', 'REJECTED', 3),
    (v_approval_id, '已撤回', 'WITHDRAWN', 4)
    ON CONFLICT (type_id, value) DO NOTHING;
END $$;
