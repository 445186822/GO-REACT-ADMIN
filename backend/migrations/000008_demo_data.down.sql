DELETE FROM sys_task_executions WHERE task_id IN (SELECT id FROM sys_scheduled_tasks WHERE name IN ('每日数据备份', '周报生成', '缓存清理', 'AI分析任务'));
DELETE FROM sys_scheduled_tasks WHERE name IN ('每日数据备份', '周报生成', '缓存清理', 'AI分析任务');
DELETE FROM kb_faqs WHERE question LIKE '如何%' OR question LIKE '忘记%' OR question LIKE '工作流%' OR question LIKE '数据字典%' OR question LIKE '系统监控%';
DELETE FROM kb_articles WHERE title IN ('企业平台快速上手', 'RBAC权限体系说明', '工作流引擎使用指南', '系统监控面板说明', '定时任务配置参考', '数据字典使用手册');
DELETE FROM kb_categories WHERE name IN ('快速入门', '功能指南', '常见问题', '系统管理', '业务流程');
DELETE FROM sys_workflows WHERE name IN ('请假审批流程', '客户入驻流程');
DELETE FROM sys_approval_instances WHERE biz_id IN ('leave_001', 'leave_002', 'leave_003', 'exp_001', 'exp_002', 'pur_001');
DELETE FROM sys_approval_templates WHERE biz_type IN ('leave', 'reimbursement', 'purchase');
DELETE FROM sys_recycled WHERE source_id IN (997, 998, 999);
