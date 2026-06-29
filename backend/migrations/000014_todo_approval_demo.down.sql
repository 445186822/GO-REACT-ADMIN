DELETE FROM approval_actions
WHERE instance_id IN (
    SELECT id FROM approval_instances WHERE biz_id IN ('leave_demo_dept', 'leave_demo_hr', 'customer_demo_review', 'leave_demo_done')
);

DELETE FROM sys_notifications
WHERE source_module = 'approval'
  AND content IN ('王五病假申请（3天）', '赵六年假申请（5天）', 'ABC公司入驻申请', '钱七调休申请（1天）');

DELETE FROM approval_instances
WHERE biz_id IN ('leave_demo_dept', 'leave_demo_hr', 'customer_demo_review', 'leave_demo_done');

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

DELETE FROM sys_user_roles
WHERE user_id IN (SELECT id FROM sys_users WHERE username IN ('dept_manager', 'hr_manager', 'customer_manager', 'demo_applicant'));

DELETE FROM sys_users
WHERE username IN ('dept_manager', 'hr_manager', 'customer_manager', 'demo_applicant');

DELETE FROM sys_role_menus
WHERE role_id IN (SELECT id FROM sys_roles WHERE code IN ('DEPT_MANAGER', 'HR_MANAGER', 'CUSTOMER_MANAGER'));

DELETE FROM sys_roles
WHERE code IN ('DEPT_MANAGER', 'HR_MANAGER', 'CUSTOMER_MANAGER');

DELETE FROM sys_role_menus
WHERE menu_id IN (SELECT id FROM sys_menus WHERE code = 'todo:view');

UPDATE sys_menus
SET deleted_at = now(), updated_at = now()
WHERE code = 'todo:view' AND deleted_at IS NULL;
