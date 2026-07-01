SELECT setval(pg_get_serial_sequence('sys_roles', 'id'), COALESCE((SELECT max(id) FROM sys_roles), 1), true);

INSERT INTO sys_roles (code, name, description, status)
VALUES ('GENERAL_MANAGER', '总经理', '审批测试：处理金额超过 1000 的审批节点', 'ACTIVE')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    deleted_at = NULL,
    updated_at = now();

SELECT setval(pg_get_serial_sequence('sys_users', 'id'), COALESCE((SELECT max(id) FROM sys_users), 1), true);

INSERT INTO sys_users (username, password_hash, display_name, department_id, status)
VALUES ('general_manager', '$2a$10$0hj./IKNdJf7sdl7MgvLWORTU7IPGoo3mUpDyKAbrU.niJa75FsMC', '总经理', NULL, 'ACTIVE')
ON CONFLICT (username) DO UPDATE
SET display_name = EXCLUDED.display_name,
    password_hash = EXCLUDED.password_hash,
    department_id = EXCLUDED.department_id,
    status = EXCLUDED.status,
    deleted_at = NULL,
    updated_at = now();

INSERT INTO sys_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM sys_users u
JOIN sys_roles r ON r.code = 'GENERAL_MANAGER'
WHERE u.username = 'general_manager'
ON CONFLICT DO NOTHING;

WITH approver_role AS (
    SELECT id FROM sys_roles WHERE code = 'GENERAL_MANAGER'
),
allowed_menus AS (
    SELECT id FROM sys_menus
    WHERE code IN ('dashboard', 'todo:view', 'approval:view', 'approval:submit', 'approval:action', 'workflow:view', 'workflow:update', 'notification:view')
)
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT r.id, m.id, 'ALL'
FROM approver_role r
CROSS JOIN allowed_menus m
ON CONFLICT DO NOTHING;

DELETE FROM workflow_logs
WHERE instance_id IN (
    SELECT wi.id
    FROM workflow_instances wi
    JOIN workflow_definitions wd ON wd.id = wi.definition_id
    WHERE wd.name = '金额审批测试流程'
);

DELETE FROM workflow_instances
WHERE definition_id IN (SELECT id FROM workflow_definitions WHERE name = '金额审批测试流程');

DELETE FROM approval_actions
WHERE instance_id IN (
    SELECT ai.id
    FROM approval_instances ai
    JOIN workflow_definitions wd ON wd.id = ai.workflow_definition_id
    WHERE wd.name = '金额审批测试流程'
);

DELETE FROM approval_instance_nodes
WHERE instance_id IN (
    SELECT ai.id
    FROM approval_instances ai
    JOIN workflow_definitions wd ON wd.id = ai.workflow_definition_id
    WHERE wd.name = '金额审批测试流程'
);

DELETE FROM approval_instances
WHERE workflow_definition_id IN (SELECT id FROM workflow_definitions WHERE name = '金额审批测试流程');

DELETE FROM workflow_definitions WHERE name = '金额审批测试流程';

INSERT INTO workflow_definitions (name, category, description, definition, status, created_by, created_at, updated_at)
VALUES (
    '金额审批测试流程',
    'approval',
    '测试流程快照、实例节点、条件分支、审批动作目标和状态变化：amount > 1000 走总经理，否则走部门负责人。',
    '{
      "nodes": [
        {
          "id": "start",
          "type": "workflowNode",
          "position": { "x": 80, "y": 220 },
          "data": { "key": "start", "name": "提交申请", "nodeType": "start" }
        },
        {
          "id": "amount_check",
          "type": "workflowNode",
          "position": { "x": 360, "y": 220 },
          "data": {
            "key": "amount_check",
            "name": "金额判断",
            "nodeType": "condition",
            "config": {
              "conditions": [
                { "expression": "form.amount > 1000", "target": "manager_approval" }
              ],
              "defaultTarget": "dept_approval"
            }
          }
        },
        {
          "id": "dept_approval",
          "type": "workflowNode",
          "position": { "x": 680, "y": 110 },
          "data": {
            "key": "dept_approval",
            "name": "部门审批",
            "nodeType": "approval",
            "assignee": "部门负责人",
            "config": {
              "actions": [
                { "code": "APPROVE", "label": "通过", "target": "approved_end", "instanceStatus": "PENDING" },
                { "code": "REJECT", "label": "驳回", "target": "rejected_end", "instanceStatus": "REJECTED", "requireComment": true }
              ]
            }
          }
        },
        {
          "id": "manager_approval",
          "type": "workflowNode",
          "position": { "x": 680, "y": 330 },
          "data": {
            "key": "manager_approval",
            "name": "总经理审批",
            "nodeType": "approval",
            "assignee": "总经理",
            "config": {
              "actions": [
                { "code": "APPROVE", "label": "通过", "target": "approved_end", "instanceStatus": "PENDING" },
                { "code": "REJECT", "label": "驳回", "target": "rejected_end", "instanceStatus": "REJECTED", "requireComment": true }
              ]
            }
          }
        },
        {
          "id": "approved_end",
          "type": "workflowNode",
          "position": { "x": 1040, "y": 150 },
          "data": {
            "key": "approved_end",
            "name": "通过结束",
            "nodeType": "end",
            "config": { "finalStatus": "APPROVED" }
          }
        },
        {
          "id": "rejected_end",
          "type": "workflowNode",
          "position": { "x": 1040, "y": 300 },
          "data": {
            "key": "rejected_end",
            "name": "驳回结束",
            "nodeType": "end",
            "config": { "finalStatus": "REJECTED" }
          }
        }
      ],
      "edges": [
        { "id": "edge_start_amount", "source": "start", "target": "amount_check" },
        { "id": "edge_amount_dept", "source": "amount_check", "target": "dept_approval", "label": "amount <= 1000" },
        { "id": "edge_amount_manager", "source": "amount_check", "target": "manager_approval", "label": "amount > 1000" },
        { "id": "edge_dept_approved", "source": "dept_approval", "target": "approved_end", "label": "通过" },
        { "id": "edge_dept_rejected", "source": "dept_approval", "target": "rejected_end", "label": "驳回" },
        { "id": "edge_manager_approved", "source": "manager_approval", "target": "approved_end", "label": "通过" },
        { "id": "edge_manager_rejected", "source": "manager_approval", "target": "rejected_end", "label": "驳回" }
      ]
    }'::jsonb,
    'ACTIVE',
    (SELECT id FROM sys_users WHERE username = 'admin' LIMIT 1),
    now(),
    now()
);
