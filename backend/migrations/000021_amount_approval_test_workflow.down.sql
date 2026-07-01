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

DELETE FROM sys_user_roles
WHERE role_id IN (SELECT id FROM sys_roles WHERE code = 'GENERAL_MANAGER')
  AND user_id IN (SELECT id FROM sys_users WHERE username IN ('admin', 'general_manager'));

DELETE FROM sys_role_menus
WHERE role_id IN (SELECT id FROM sys_roles WHERE code = 'GENERAL_MANAGER');

DELETE FROM sys_users WHERE username = 'general_manager';

DELETE FROM sys_roles WHERE code = 'GENERAL_MANAGER';
