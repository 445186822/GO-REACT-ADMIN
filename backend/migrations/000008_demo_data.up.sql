-- Demo Data for Enterprise Base Template

-- 1. Scheduled Tasks
INSERT INTO sys_scheduled_tasks (name, cron_expr, task_type, config, enabled, last_run_at, remark) VALUES
('每日数据备份', '0 2 * * *', 'DATA_SYNC', '{"source":"all_tables"}'::jsonb, true, now() - interval '8 hours', '每天凌晨2点自动备份全库数据'),
('周报生成', '0 8 * * 1', 'REPORT_GEN', '{"type":"weekly"}'::jsonb, true, now() - interval '2 days', '每周一早8点生成上周业务周报'),
('缓存清理', '0 */6 * * *', 'DATA_CLEANUP', '{"ttl":3600}'::jsonb, false, now() - interval '1 day', '每6小时清理过期缓存'),
('AI分析任务', '0 9 * * *', 'AI_ANALYSIS', '{"topics":["trend"]}'::jsonb, true, now() - interval '12 hours', '每天早9点执行AI业务分析');

INSERT INTO sys_task_executions (task_id, status, started_at, finished_at, output)
SELECT id, 'SUCCESS', now() - interval '8 hours', now() - interval '8 hours' + interval '3 minutes', '备份完成，12张表，45MB'
FROM sys_scheduled_tasks WHERE name = '每日数据备份'
UNION ALL
SELECT id, 'SUCCESS', now() - interval '32 hours', now() - interval '32 hours' + interval '2 minutes', '备份完成，12张表，42MB'
FROM sys_scheduled_tasks WHERE name = '每日数据备份'
UNION ALL
SELECT id, 'SUCCESS', now() - interval '2 days', now() - interval '2 days' + interval '1 minute', '周报已生成并发送'
FROM sys_scheduled_tasks WHERE name = '周报生成'
UNION ALL
SELECT id, 'FAILED', now() - interval '9 days', now() - interval '9 days' + interval '30 seconds', NULL
FROM sys_scheduled_tasks WHERE name = '周报生成'
UNION ALL
SELECT id, 'SUCCESS', now() - interval '6 hours', now() - interval '6 hours' + interval '30 seconds', '清理完成，释放128MB'
FROM sys_scheduled_tasks WHERE name = '缓存清理'
UNION ALL
SELECT id, 'SUCCESS', now() - interval '12 hours', now() - interval '12 hours' + interval '45 seconds', 'AI分析完成'
FROM sys_scheduled_tasks WHERE name = 'AI分析任务';

-- 2. Knowledge Base
INSERT INTO kb_categories (id, name, parent_id, sort_order, status) VALUES
(1, '快速入门', NULL, 1, 'ENABLED'),
(2, '功能指南', NULL, 2, 'ENABLED'),
(3, '常见问题', NULL, 3, 'ENABLED'),
(4, '系统管理', 2, 1, 'ENABLED'),
(5, '业务流程', 2, 2, 'ENABLED')
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, content, category_id, tags, is_pinned, view_count, like_count, status, author_id) VALUES
('企业平台快速上手', '企业级应用基础框架，包含RBAC权限、数据字典、工作流引擎、审批中心、知识库、系统监控等核心功能。', 1, '入门', true, 1250, 86, 'PUBLISHED', 1),
('RBAC权限体系说明', '基于角色的访问控制(RBAC)，核心概念：用户、角色、菜单、数据权限(ALL/DEPT/SELF)。', 4, '权限', true, 890, 52, 'PUBLISHED', 1),
('工作流引擎使用指南', '支持节点类型：start/approval/condition/parallel/notification/end。创建流程：定义名称→添加节点→配置属性→发布运行。', 5, '工作流', false, 650, 38, 'PUBLISHED', 1),
('系统监控面板说明', '实时监控Go运行时状态、内存使用、数据库连接数、业务指标统计、API请求延迟。', 4, '监控', false, 420, 25, 'PUBLISHED', 1),
('定时任务配置参考', 'Cron表达式示例：0 2 * * *(每天2点)、0 8 * * 1(每周一8点)。支持DATA_SYNC/REPORT_GEN/NOTIFICATION/DATA_CLEANUP/AI_ANALYSIS等类型。', 5, '调度', false, 310, 19, 'PUBLISHED', 1),
('数据字典使用手册', '字典类型定义编码和名称，字典项定义具体选项。预置：GENDER(性别)、USER_STATUS(用户状态)、APPROVAL_STATUS(审批状态)。', 1, '字典', false, 280, 16, 'PUBLISHED', 1);

INSERT INTO kb_faqs (question, answer, category_id, sort_order, view_count, like_count, status) VALUES
('如何创建新用户？', '进入系统管理→用户管理，点击新增用户按钮，填写用户名、密码、所属部门等信息。', 3, 1, 150, 22, 'ENABLED'),
('忘记了管理员密码怎么办？', '联系系统管理员在用户管理中进行密码重置。', 3, 2, 120, 15, 'ENABLED'),
('工作流运行后可以暂停吗？', '可以。在工作流引擎→运行实例中找到对应实例进行暂停/恢复操作。', 3, 3, 95, 12, 'ENABLED'),
('数据字典如何导入导出？', '数据字典支持JSON格式的导入导出，在字典管理页面操作即可。', 3, 4, 80, 10, 'ENABLED'),
('系统监控数据多久刷新一次？', '系统监控数据在打开页面时实时获取，后端指标即时采集。', 3, 5, 65, 8, 'ENABLED');

-- 3. Workflow Definitions
INSERT INTO workflow_definitions (name, category, description, definition, status, created_by, created_at, updated_at) VALUES
('请假审批流程', 'approval', '员工请假审批标准流程：提交→部门审批→HR确认→归档', '{"nodes":[{"key":"start","name":"提交请假申请","type":"start"},{"key":"dept_approval","name":"部门负责人审批","type":"approval","assignee":"部门负责人"},{"key":"hr_confirm","name":"HR确认","type":"approval","assignee":"HR经理"},{"key":"notify","name":"通知申请人","type":"notification"},{"key":"end","name":"归档","type":"end"}]}'::jsonb, 'ACTIVE', 1, now() - interval '30 days', now()),
('客户入驻流程', 'approval', '新客户入驻SOP：申请提交→资料审核→合规检查→创建账户→欢迎邮件→完成', '{"nodes":[{"key":"start","name":"客户提交申请","type":"start"},{"key":"review","name":"资料审核","type":"approval","assignee":"客户经理"},{"key":"check","name":"合规检查","type":"condition"},{"key":"create_account","name":"创建账户","type":"action"},{"key":"send_welcome","name":"欢迎邮件","type":"notification"},{"key":"end","name":"入驻完成","type":"end"}]}'::jsonb, 'ACTIVE', 1, now() - interval '15 days', now());

-- Workflow Instances
INSERT INTO workflow_instances (definition_id, title, status, input, started_by, started_at, ended_at)
SELECT id, '张三请假审批-20260620', 'COMPLETED', '{"reason":"年假","days":5}'::jsonb, 1, now() - interval '7 days', now() - interval '7 days' + interval '2 hours'
FROM workflow_definitions WHERE name = '请假审批流程'
UNION ALL
SELECT id, '李四请假审批-20260624', 'RUNNING', '{"reason":"事假","days":1}'::jsonb, 1, now() - interval '2 hours', NULL
FROM workflow_definitions WHERE name = '请假审批流程'
UNION ALL
SELECT id, 'ABC公司入驻流程', 'COMPLETED', '{"company":"ABC科技有限公司"}'::jsonb, 1, now() - interval '10 days', now() - interval '10 days' + interval '4 hours'
FROM workflow_definitions WHERE name = '客户入驻流程';

-- 4. Approval Instances
INSERT INTO approval_instances (workflow_definition_id, title, biz_type, biz_id, applicant_id, status, current_step, form_data, created_at, updated_at)
SELECT id, '张三的年假申请（5天）', 'leave', 'leave_001', 1, 'APPROVED', 2, '{"reason":"家庭旅游","days":5}'::jsonb, now() - interval '5 days', now() - interval '4 days'
FROM workflow_definitions WHERE name = '请假审批流程'
UNION ALL
SELECT id, '王五的病假申请（3天）', 'leave', 'leave_003', 1, 'PENDING', 0, '{"reason":"感冒发烧","days":3}'::jsonb, now() - interval '1 day', now() - interval '1 day'
FROM workflow_definitions WHERE name = '请假审批流程'
UNION ALL
SELECT id, 'ABC公司入驻申请', 'customer_onboarding', 'customer_001', 1, 'PENDING', 0, '{"company":"ABC科技有限公司"}'::jsonb, now() - interval '10 hours', now() - interval '10 hours'
FROM workflow_definitions WHERE name = '客户入驻流程';

-- 5. Recycle Bin
INSERT INTO sys_recycled (source_table, source_id, summary, deleted_by, deleted_at) VALUES
('biz_customers', 999, '测试客户A（已删除示例）', 1, now() - interval '1 day'),
('biz_customers', 998, '测试客户B（已删除示例）', 1, now() - interval '3 days'),
('biz_customers', 997, '测试客户C（已删除示例）', 1, now() - interval '7 days');

-- 6. AI Chat History table
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES sys_users(id),
    role TEXT NOT NULL DEFAULT 'user',
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_history(user_id, created_at DESC);
