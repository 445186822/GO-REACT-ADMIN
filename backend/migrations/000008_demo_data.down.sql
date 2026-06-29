DELETE FROM sys_task_executions
WHERE task_id IN (
    SELECT id FROM sys_scheduled_tasks
    WHERE name IN ('每日数据备份', '周报生成', '缓存清理', 'AI分析任务')
);

DELETE FROM sys_scheduled_tasks
WHERE name IN ('每日数据备份', '周报生成', '缓存清理', 'AI分析任务');

DELETE FROM kb_faqs
WHERE question IN (
    '如何创建新用户？',
    '忘记了管理员密码怎么办？',
    '工作流运行后可以暂停吗？',
    '数据字典如何导入导出？',
    '系统监控数据多久刷新一次？'
);

DELETE FROM kb_articles
WHERE title IN (
    '企业平台快速上手',
    'RBAC权限体系说明',
    '工作流引擎使用指南',
    '系统监控面板说明',
    '定时任务配置参考',
    '数据字典使用手册'
);

DELETE FROM kb_categories
WHERE name IN ('快速入门', '功能指南', '常见问题', '系统管理', '业务流程');

DELETE FROM approval_actions
WHERE instance_id IN (
    SELECT id FROM approval_instances
    WHERE biz_id IN ('leave_001', 'leave_003', 'customer_001')
);

DELETE FROM approval_instances
WHERE biz_id IN ('leave_001', 'leave_003', 'customer_001');

DELETE FROM workflow_logs
WHERE instance_id IN (
    SELECT wi.id
    FROM workflow_instances wi
    JOIN workflow_definitions wd ON wd.id = wi.definition_id
    WHERE wd.name IN ('请假审批流程', '客户入驻流程')
);

DELETE FROM workflow_instances
WHERE definition_id IN (
    SELECT id FROM workflow_definitions
    WHERE name IN ('请假审批流程', '客户入驻流程')
);

DELETE FROM workflow_definitions
WHERE name IN ('请假审批流程', '客户入驻流程');

DELETE FROM sys_recycled WHERE source_id IN (997, 998, 999);
