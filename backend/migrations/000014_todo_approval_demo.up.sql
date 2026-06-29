WITH collaboration_parent AS (
    SELECT id FROM sys_menus WHERE code = 'collaboration'
),
todo_menu AS (
    INSERT INTO sys_menus (parent_id, type, code, name, path, component, icon, sort_order)
    SELECT id, 'page', 'todo:view', '待办中心', '/collaboration/todos', 'TodoCenterPage', 'ClockCircleOutlined', 30
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
)
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT r.id, m.id, 'ALL'
FROM sys_roles r
CROSS JOIN todo_menu m
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('sys_roles', 'id'), COALESCE((SELECT max(id) FROM sys_roles), 1), true);

INSERT INTO sys_roles (code, name, description, status)
VALUES
    ('DEPT_MANAGER', '部门负责人', '审批演示：处理部门审批节点', 'ACTIVE'),
    ('HR_MANAGER', 'HR经理', '审批演示：处理HR确认节点', 'ACTIVE'),
    ('CUSTOMER_MANAGER', '客户经理', '审批演示：处理客户资料审核节点', 'ACTIVE')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    deleted_at = NULL,
    updated_at = now();

SELECT setval(pg_get_serial_sequence('sys_users', 'id'), COALESCE((SELECT max(id) FROM sys_users), 1), true);

INSERT INTO sys_users (username, password_hash, display_name, department_id, status)
SELECT seed.username, '$2a$10$ynV63Fh0TG.N8SUoZbOk5uY3gxyIuxTPISoYJxxEo86VKYhWQnAnC', seed.display_name, NULL, 'ACTIVE'
FROM (
    VALUES
        ('dept_manager', '部门负责人'),
        ('hr_manager', 'HR经理'),
        ('customer_manager', '客户经理'),
        ('demo_applicant', '测试申请人')
) AS seed(username, display_name)
ON CONFLICT (username) DO UPDATE
SET display_name = EXCLUDED.display_name,
    password_hash = EXCLUDED.password_hash,
    department_id = EXCLUDED.department_id,
    status = EXCLUDED.status,
    deleted_at = NULL,
    updated_at = now();

INSERT INTO sys_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (
    VALUES
        ('dept_manager', 'DEPT_MANAGER'),
        ('hr_manager', 'HR_MANAGER'),
        ('customer_manager', 'CUSTOMER_MANAGER')
) AS seed(username, role_code)
JOIN sys_users u ON u.username = seed.username
JOIN sys_roles r ON r.code = seed.role_code
ON CONFLICT DO NOTHING;

WITH approver_roles AS (
    SELECT id FROM sys_roles WHERE code IN ('DEPT_MANAGER', 'HR_MANAGER', 'CUSTOMER_MANAGER')
),
allowed_menus AS (
    SELECT id FROM sys_menus
    WHERE code IN ('dashboard', 'todo:view', 'approval:view', 'approval:action', 'notification:view')
)
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT r.id, m.id, 'ALL'
FROM approver_roles r
CROSS JOIN allowed_menus m
ON CONFLICT DO NOTHING;

DELETE FROM approval_actions
WHERE instance_id IN (
    SELECT id FROM approval_instances
    WHERE biz_id IN ('leave_001', 'leave_002', 'leave_003', 'exp_001', 'exp_002', 'pur_001', 'leave_demo_dept', 'leave_demo_hr', 'customer_demo_review', 'leave_demo_done')
);

DELETE FROM sys_notifications
WHERE source_module = 'approval';

DELETE FROM approval_instances
WHERE biz_id IN ('leave_001', 'leave_002', 'leave_003', 'exp_001', 'exp_002', 'pur_001', 'leave_demo_dept', 'leave_demo_hr', 'customer_demo_review', 'leave_demo_done');

DELETE FROM workflow_logs
WHERE instance_id IN (
    SELECT wi.id
    FROM workflow_instances wi
    JOIN workflow_definitions wd ON wd.id = wi.definition_id
    WHERE wd.name IN ('请假审批流程', '客户入驻流程')
);

DELETE FROM workflow_instances
WHERE definition_id IN (
    SELECT id FROM workflow_definitions WHERE name IN ('请假审批流程', '客户入驻流程')
);

DELETE FROM workflow_definitions
WHERE name IN ('请假审批流程', '客户入驻流程');

WITH leave_workflow AS (
    INSERT INTO workflow_definitions (name, category, description, definition, status, created_by, created_at, updated_at)
    VALUES (
        '请假审批流程',
        'approval',
        '审批演示：提交 -> 部门负责人审批 -> HR确认 -> 通知申请人 -> 结束',
        '{"nodes":[{"id":"start","type":"workflowNode","position":{"x":100,"y":200},"data":{"key":"start","name":"提交申请","nodeType":"start"}},{"id":"dept_approval","type":"workflowNode","position":{"x":420,"y":200},"data":{"key":"dept_approval","name":"部门负责人审批","nodeType":"approval","assignee":"部门负责人"}},{"id":"hr_confirm","type":"workflowNode","position":{"x":740,"y":200},"data":{"key":"hr_confirm","name":"HR确认","nodeType":"approval","assignee":"HR经理"}},{"id":"notify","type":"workflowNode","position":{"x":1060,"y":200},"data":{"key":"notify","name":"通知申请人","nodeType":"notification"}},{"id":"end","type":"workflowNode","position":{"x":1380,"y":200},"data":{"key":"end","name":"结束","nodeType":"end"}}],"edges":[{"id":"edge_start_dept","source":"start","target":"dept_approval"},{"id":"edge_dept_hr","source":"dept_approval","target":"hr_confirm"},{"id":"edge_hr_notify","source":"hr_confirm","target":"notify"},{"id":"edge_notify_end","source":"notify","target":"end"}]}'::jsonb,
        'ACTIVE',
        NULL,
        now() - interval '3 days',
        now()
    )
    RETURNING id
),
customer_workflow AS (
    INSERT INTO workflow_definitions (name, category, description, definition, status, created_by, created_at, updated_at)
    VALUES (
        '客户入驻流程',
        'approval',
        '审批演示：客户提交 -> 客户经理资料审核 -> 合规检查 -> 创建账户 -> 通知客户 -> 完成',
        '{"nodes":[{"id":"start","type":"workflowNode","position":{"x":100,"y":200},"data":{"key":"start","name":"客户提交申请","nodeType":"start"}},{"id":"review","type":"workflowNode","position":{"x":420,"y":200},"data":{"key":"review","name":"资料审核","nodeType":"approval","assignee":"客户经理"}},{"id":"check","type":"workflowNode","position":{"x":740,"y":200},"data":{"key":"check","name":"合规检查","nodeType":"condition"}},{"id":"create_account","type":"workflowNode","position":{"x":1060,"y":200},"data":{"key":"create_account","name":"创建账户","nodeType":"action"}},{"id":"send_welcome","type":"workflowNode","position":{"x":1380,"y":200},"data":{"key":"send_welcome","name":"发送通知","nodeType":"notification"}},{"id":"end","type":"workflowNode","position":{"x":1700,"y":200},"data":{"key":"end","name":"完成","nodeType":"end"}}],"edges":[{"id":"edge_start_review","source":"start","target":"review"},{"id":"edge_review_check","source":"review","target":"check"},{"id":"edge_check_create","source":"check","target":"create_account"},{"id":"edge_create_notify","source":"create_account","target":"send_welcome"},{"id":"edge_notify_end","source":"send_welcome","target":"end"}]}'::jsonb,
        'ACTIVE',
        NULL,
        now() - interval '2 days',
        now()
    )
    RETURNING id
),
applicant_user AS (
    SELECT id FROM sys_users WHERE username = 'demo_applicant'
),
inserted_instances AS (
    INSERT INTO approval_instances (workflow_definition_id, title, biz_type, biz_id, applicant_id, status, current_step, form_data, created_at, updated_at)
    SELECT lw.id, '王五病假申请（3天）', 'leave_demo', 'leave_demo_dept', au.id, 'PENDING', 0, '{"reason":"审批演示：病假","days":3}'::jsonb, now() - interval '8 hours', now() - interval '8 hours'
    FROM leave_workflow lw CROSS JOIN applicant_user au
    UNION ALL
    SELECT lw.id, '赵六年假申请（5天）', 'leave_demo', 'leave_demo_hr', au.id, 'PENDING', 1, '{"reason":"审批演示：年假","days":5}'::jsonb, now() - interval '6 hours', now() - interval '5 hours'
    FROM leave_workflow lw CROSS JOIN applicant_user au
    UNION ALL
    SELECT lw.id, '钱七调休申请（1天）', 'leave_demo', 'leave_demo_done', au.id, 'APPROVED', 1, '{"reason":"审批演示：调休","days":1}'::jsonb, now() - interval '2 days', now() - interval '1 day'
    FROM leave_workflow lw CROSS JOIN applicant_user au
    UNION ALL
    SELECT cw.id, 'ABC公司入驻申请', 'customer_onboarding_demo', 'customer_demo_review', au.id, 'PENDING', 0, '{"company":"ABC公司","contact":"李雷"}'::jsonb, now() - interval '4 hours', now() - interval '4 hours'
    FROM customer_workflow cw CROSS JOIN applicant_user au
    RETURNING id, biz_id
),
dept_user AS (
    SELECT id FROM sys_users WHERE username = 'dept_manager'
),
hr_user AS (
    SELECT id FROM sys_users WHERE username = 'hr_manager'
),
customer_user AS (
    SELECT id FROM sys_users WHERE username = 'customer_manager'
)
INSERT INTO approval_actions (instance_id, step_index, approver_id, action, comment, created_at)
SELECT i.id, 0, d.id, 'APPROVE', '审批演示：部门负责人已通过', now() - interval '5 hours'
FROM inserted_instances i CROSS JOIN dept_user d
WHERE i.biz_id = 'leave_demo_hr'
UNION ALL
SELECT i.id, 0, d.id, 'APPROVE', '审批演示：部门负责人已通过', now() - interval '1 day 20 hours'
FROM inserted_instances i CROSS JOIN dept_user d
WHERE i.biz_id = 'leave_demo_done'
UNION ALL
SELECT i.id, 1, h.id, 'APPROVE', '审批演示：HR已确认', now() - interval '1 day'
FROM inserted_instances i CROSS JOIN hr_user h
WHERE i.biz_id = 'leave_demo_done';

INSERT INTO sys_notifications (title, content, notif_type, source_module, recipient_id, created_by)
SELECT '待处理审批', '王五病假申请（3天）', 'approval', 'approval', u.id, NULL::bigint
FROM sys_users u WHERE u.username = 'dept_manager'
UNION ALL
SELECT '待处理审批', '赵六年假申请（5天）', 'approval', 'approval', u.id, NULL::bigint
FROM sys_users u WHERE u.username = 'hr_manager'
UNION ALL
SELECT '待处理审批', 'ABC公司入驻申请', 'approval', 'approval', u.id, NULL::bigint
FROM sys_users u WHERE u.username = 'customer_manager';
