-- Demo scheduled tasks: visible effects users can trigger and verify

-- 1. System report — generates a real system status report every day at 8 AM
INSERT INTO sys_scheduled_tasks (name, cron_expr, task_type, enabled, remark, next_run_at)
VALUES (
    '系统运行日报',
    '0 8 * * *',
    'REPORT_GEN',
    true,
    '每天早上8点自动生成系统运行报告，统计用户数、通知数、审批数',
    now() + interval '1 minute'
) ON CONFLICT DO NOTHING;

-- 2. Data cleanup — cleans old notifications every day at 2 AM
INSERT INTO sys_scheduled_tasks (name, cron_expr, task_type, enabled, remark, next_run_at)
VALUES (
    '过期通知清理',
    '0 2 * * *',
    'DATA_CLEANUP',
    true,
    '每天凌晨2点清理超过30天的已读通知',
    now() + interval '2 minutes'
) ON CONFLICT DO NOTHING;

-- 3. AI health check — runs every 6 hours
INSERT INTO sys_scheduled_tasks (name, cron_expr, task_type, enabled, remark, next_run_at)
VALUES (
    'AI 系统健康检查',
    '0 */6 * * *',
    'AI_ANALYSIS',
    true,
    '每6小时运行一次 AI 系统健康分析',
    now() + interval '3 minutes'
) ON CONFLICT DO NOTHING;
