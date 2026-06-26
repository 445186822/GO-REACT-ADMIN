package database

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	cfg.MaxConns = 10
	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create database pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

func Migrate(ctx context.Context, pool *pgxpool.Pool, migrationsDir string) error {
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}

	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.up.sql"))
	if err != nil {
		return err
	}
	sort.Strings(files)

	for _, file := range files {
		version := strings.TrimSuffix(filepath.Base(file), ".up.sql")
		var exists bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, version); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

func Seed(ctx context.Context, pool *pgxpool.Pool, initialAdminPassword string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
INSERT INTO sys_departments (id, code, name, sort_order)
VALUES (1, 'HQ', 'Headquarters', 1)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO sys_roles (id, code, name, description)
VALUES (1, 'ADMIN', 'System Administrator', 'Full system access')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`); err != nil {
		return err
	}

	var adminExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM sys_users WHERE username = 'admin' AND deleted_at IS NULL)`).Scan(&adminExists); err != nil {
		return err
	}

	if !adminExists {
		if initialAdminPassword == "" {
			return fmt.Errorf("INITIAL_ADMIN_PASSWORD is required for first-time admin initialization")
		}
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(initialAdminPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO sys_users (id, username, password_hash, display_name, department_id, is_super_admin)
VALUES (1, 'admin', $1, 'System Administrator', 1, true)`, string(passwordHash)); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO sys_user_roles (user_id, role_id)
VALUES (1, 1)
ON CONFLICT DO NOTHING`); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `SELECT setval(pg_get_serial_sequence('sys_menus', 'id'), COALESCE((SELECT max(id) FROM sys_menus), 1), true)`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, seedMenusSQL); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
UPDATE sys_menus SET deleted_at = now(), updated_at = now()
WHERE code IN ('kb:article:view', 'kb:faq:view', 'kb:category:view') AND deleted_at IS NULL`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
UPDATE sys_menus SET deleted_at = NULL, status = 'ACTIVE', updated_at = now()
WHERE code IN ('knowledge', 'kb:view', 'kb:update');

UPDATE sys_menus child
SET parent_id = parent.id, updated_at = now()
FROM sys_menus parent
WHERE child.code = 'kb:view' AND parent.code = 'knowledge';

UPDATE sys_menus child
SET parent_id = parent.id, updated_at = now()
FROM sys_menus parent
WHERE child.code = 'kb:update' AND parent.code = 'kb:view'`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT 1, id, 'ALL' FROM sys_menus WHERE deleted_at IS NULL ON CONFLICT DO NOTHING`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, seedSettingsSQL); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

const seedMenusSQL = `
WITH seed(parent_code, type, code, name, path, component, icon, sort_order) AS (
  VALUES
    (NULL, 'page', 'dashboard', 'Dashboard', '/dashboard', 'DashboardPage', 'DashboardOutlined', 1),
    (NULL, 'directory', 'system', 'System Management', NULL, NULL, 'SettingOutlined', 10),
    ('system', 'page', 'user:view', 'Users', '/system/users', 'UserListPage', 'UserOutlined', 11),
    ('system', 'page', 'role:view', 'Roles', '/system/roles', 'RoleListPage', 'TeamOutlined', 12),
    ('system', 'page', 'menu:view', 'Menus', '/system/menus', 'MenuListPage', 'MenuOutlined', 13),
    ('system', 'page', 'department:view', 'Departments', '/system/departments', 'DepartmentListPage', 'ApartmentOutlined', 14),
    ('system', 'page', 'datadict:view', '数据字典', '/system/data-dict', 'DataDictPage', 'DatabaseOutlined', 15),
    ('system', 'page', 'recycle:view', '回收站', '/system/recycle-bin', 'RecycleBinPage', 'DeleteOutlined', 16),
    ('system', 'page', 'monitor:view', '系统监控', '/system/monitor', 'SystemMonitorPage', 'DashboardOutlined', 17),
    ('system', 'page', 'scheduler:view', '定时任务', '/system/scheduler', 'SchedulerPage', 'ScheduleOutlined', 18),
    (NULL, 'directory', 'business', 'Business', NULL, NULL, 'AppstoreOutlined', 20),
    (NULL, 'directory', 'knowledge', '知识库', NULL, NULL, 'ReadOutlined', 40),
    ('knowledge', 'page', 'kb:view', '知识库工作台', '/knowledge-base', 'KnowledgeBasePage', 'BookOutlined', 41),
    ('kb:view', 'button', 'kb:update', 'Maintain Knowledge Base', NULL, NULL, NULL, 421),
    ('business', 'page', 'customer:view', 'Customers', '/business/customers', 'CustomerListPage', 'ContactsOutlined', 21),
    (NULL, 'directory', 'collaboration', 'Collaboration', NULL, NULL, 'BranchesOutlined', 30),
    ('collaboration', 'page', 'notification:view', 'Notifications', '/collaboration/notifications', 'NotificationCenterPage', 'BellOutlined', 31),
    ('collaboration', 'page', 'message-template:view', 'Message Templates', '/collaboration/message-templates', 'MessageTemplatePage', 'MessageOutlined', 32),
    ('collaboration', 'page', 'approval:view', 'Approvals', '/collaboration/approvals', 'ApprovalCenterPage', 'CheckSquareOutlined', 33),
    ('collaboration', 'page', 'workflow:view', 'Workflows', '/collaboration/workflows', 'WorkflowPage', 'BranchesOutlined', 34),
    ('collaboration', 'page', 'ai:chat', 'AI Assistant', '/collaboration/ai-assistant', 'AIAssistantPage', 'RobotOutlined', 35),
    (NULL, 'directory', 'resources', 'Resources', NULL, NULL, 'FolderOutlined', 60),
    ('resources', 'page', 'file:view', 'Files', '/files', 'FileCenterPage', 'FolderOpenOutlined', 61),
    ('resources', 'page', 'audit:view', 'Audit Logs', '/logs/operation', 'AuditLogPage', 'FileSearchOutlined', 62),
    (NULL, 'page', 'settings:view', 'Settings', '/settings', 'SettingsPage', 'ControlOutlined', 70),
    ('user:view', 'button', 'user:create', 'Create User', NULL, NULL, NULL, 101),
    ('user:view', 'button', 'user:update', 'Update User', NULL, NULL, NULL, 102),
    ('user:view', 'button', 'user:delete', 'Delete User', NULL, NULL, NULL, 103),
    ('customer:view', 'button', 'customer:create', 'Create Customer', NULL, NULL, NULL, 201),
    ('customer:view', 'button', 'customer:update', 'Update Customer', NULL, NULL, NULL, 202),
    ('customer:view', 'button', 'customer:delete', 'Delete Customer', NULL, NULL, NULL, 203),
    ('notification:view', 'button', 'notification:create', 'Create Notification', NULL, NULL, NULL, 501),
    ('message-template:view', 'button', 'message-template:create', 'Create Message Template', NULL, NULL, NULL, 510),
    ('message-template:view', 'button', 'message-template:update', 'Update Message Template', NULL, NULL, NULL, 511),
    ('message-template:view', 'button', 'message-template:delete', 'Delete Message Template', NULL, NULL, NULL, 512),
    ('approval:view', 'button', 'approval:template:create', 'Create Approval Template', NULL, NULL, NULL, 520),
    ('approval:view', 'button', 'approval:template:update', 'Update Approval Template', NULL, NULL, NULL, 521),
    ('approval:view', 'button', 'approval:template:delete', 'Delete Approval Template', NULL, NULL, NULL, 522),
    ('approval:view', 'button', 'approval:submit', 'Submit Approval', NULL, NULL, NULL, 523),
    ('approval:view', 'button', 'approval:action', 'Handle Approval', NULL, NULL, NULL, 524),
    ('workflow:view', 'button', 'workflow:update', 'Update Workflow', NULL, NULL, NULL, 531),
    ('workflow:view', 'button', 'workflow:run', 'Run Workflow', NULL, NULL, NULL, 532),
    ('workflow:view', 'button', 'workflow:delete', 'Delete Workflow', NULL, NULL, NULL, 533),
    ('ai:chat', 'button', 'ai:send', 'Send AI Message', NULL, NULL, NULL, 541),
    ('file:view', 'button', 'file:upload', 'Upload File', NULL, NULL, NULL, 301),
    ('file:view', 'button', 'file:delete', 'Delete File', NULL, NULL, NULL, 302),
    ('settings:view', 'button', 'settings:update', 'Update Settings', NULL, NULL, NULL, 401)
),
deduped AS (
  SELECT DISTINCT ON (code) * FROM seed ORDER BY code
),
updated AS (
  UPDATE sys_menus m
  SET type = d.type,
      name = d.name,
      path = d.path,
      component = d.component,
      icon = d.icon,
      sort_order = d.sort_order,
      deleted_at = NULL,
      updated_at = now()
  FROM deduped d
  WHERE m.code = d.code
  RETURNING m.code
),
inserted AS (
  INSERT INTO sys_menus (type, code, name, path, component, icon, sort_order)
  SELECT d.type, d.code, d.name, d.path, d.component, d.icon, d.sort_order
  FROM deduped d
  WHERE NOT EXISTS (SELECT 1 FROM sys_menus m WHERE m.code = d.code)
  RETURNING code
)
UPDATE sys_menus child
SET parent_id = parent.id, updated_at = now()
FROM deduped d
LEFT JOIN sys_menus parent ON parent.code = d.parent_code
WHERE child.code = d.code;`

const seedSettingsSQL = `
INSERT INTO sys_settings (group_key, setting_key, setting_value, value_type, description, is_encrypted)
VALUES
  ('system', 'system.name', 'Enterprise Demo', 'string', '系统名称，显示在登录页、导航和浏览器标题中。', false),
  ('system', 'system.default_language', 'zh-CN', 'string', '默认界面语言。', false),
  ('system', 'system.operation_mode', 'standard', 'string', '运行模式：standard、maintenance 或 readonly。', false),
  ('security', 'security.session_timeout_minutes', '480', 'number', '访问令牌默认有效时长，单位为分钟。', false),
  ('security', 'security.password_min_length', '8', 'number', '新建用户初始密码的最小长度。', false),
  ('security', 'security.audit_retention_days', '180', 'number', '操作审计日志保留天数。', false),
  ('file', 'file.max_upload_mb', '50', 'number', '单个文件最大上传大小。', false),
  ('file', 'file.allowed_extensions', 'xlsx,pdf,docx,png,jpg,zip', 'string', '允许上传的文件扩展名白名单。', false),
  ('notification', 'notification.site_enabled', 'true', 'boolean', '是否启用站内通知。', false),
  ('notification', 'notification.email_enabled', 'false', 'boolean', '是否启用邮件通知。', false),
  ('ai', 'ai.assistant_enabled', 'true', 'boolean', '是否启用右下角 AI 助手入口。', false),
  ('ai', 'ai.provider', 'custom', 'string', 'AI 服务提供方标识。', false),
  ('ai', 'ai.endpoint', '', 'string', 'AI 服务调用地址。', false),
  ('ai', 'ai.api_key', '', 'string', 'AI 服务密钥，保存真实值时建议标记为加密。', true)
ON CONFLICT (setting_key) DO UPDATE SET
  group_key = EXCLUDED.group_key,
  value_type = EXCLUDED.value_type,
  description = EXCLUDED.description,
  is_encrypted = EXCLUDED.is_encrypted,
  updated_at = now();`
