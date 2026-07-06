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
	cfg.MinConns = 3
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 5 * time.Minute

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
	if err := validateMigrationFiles(files); err != nil {
		return err
	}

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

func validateMigrationFiles(files []string) error {
	seenByNumber := make(map[string]string, len(files))
	for _, file := range files {
		version := migrationVersion(file)
		number := migrationNumber(version)
		if number == "" {
			return fmt.Errorf("migration %s must start with a numeric prefix", filepath.Base(file))
		}
		if previous, ok := seenByNumber[number]; ok {
			if !isAllowedLegacyDuplicateMigration(number, migrationVersion(previous), version) {
				return fmt.Errorf("duplicate migration number %s: %s and %s", number, filepath.Base(previous), filepath.Base(file))
			}
		}
		seenByNumber[number] = file
	}
	return nil
}

func migrationVersion(file string) string {
	return strings.TrimSuffix(filepath.Base(file), ".up.sql")
}

func migrationNumber(version string) string {
	index := strings.Index(version, "_")
	if index <= 0 {
		return ""
	}
	number := version[:index]
	for _, char := range number {
		if char < '0' || char > '9' {
			return ""
		}
	}
	return number
}

func isAllowedLegacyDuplicateMigration(number string, versions ...string) bool {
	allowedVersions, ok := legacyDuplicateMigrationNumbers[number]
	if !ok {
		return false
	}
	for _, version := range versions {
		if _, ok := allowedVersions[version]; !ok {
			return false
		}
	}
	return true
}

var legacyDuplicateMigrationNumbers = map[string]map[string]struct{}{
	"000019": {
		"000019_chat_full":      {},
		"000019_scheduler_demo": {},
	},
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
ON CONFLICT (code) DO NOTHING`); err != nil {
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
	// Soft-delete legacy menu codes that were renamed so they don't appear as duplicates.
	if _, err := tx.Exec(ctx, `
	UPDATE sys_menus SET deleted_at = now(), updated_at = now()
	WHERE code IN ('knowledge') AND deleted_at IS NULL`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT 1, id, 'ALL' FROM sys_menus WHERE deleted_at IS NULL ON CONFLICT DO NOTHING`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, seedDemoApproverRoleMenusSQL); err != nil {
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
    (NULL, 'page', 'dashboard', '工作台', '/dashboard', 'DashboardPage', 'DashboardOutlined', 1),
    (NULL, 'directory', 'system', '系统管理', NULL, NULL, 'SettingOutlined', 10),
    ('system', 'page', 'user:view', '用户管理', '/system/users', 'UserListPage', 'UserOutlined', 11),
    ('system', 'page', 'role:view', '角色管理', '/system/roles', 'RoleListPage', 'TeamOutlined', 12),
    ('system', 'page', 'menu:view', '菜单管理', '/system/menus', 'MenuListPage', 'MenuOutlined', 13),
    ('system', 'page', 'department:view', '部门管理', '/system/departments', 'DepartmentListPage', 'ApartmentOutlined', 14),
    ('system', 'page', 'datadict:view', '数据字典', '/system/data-dict', 'DataDictPage', 'DatabaseOutlined', 15),
    ('system', 'page', 'recycle:view', '回收站', '/system/recycle-bin', 'RecycleBinPage', 'DeleteOutlined', 16),
    ('system', 'page', 'monitor:view', '系统监控', '/system/monitor', 'SystemMonitorPage', 'DashboardOutlined', 17),
    ('system', 'page', 'scheduler:view', '定时任务', '/system/scheduler', 'SchedulerPage', 'ScheduleOutlined', 18),
    ('system', 'page', 'architecture:view', '系统架构', '/system/architecture', 'ArchitecturePage', 'BranchesOutlined', 19),
    (NULL, 'directory', 'messaging', '消息与协议', NULL, NULL, 'ApiOutlined', 20),
    ('messaging', 'page', 'queue:kafka', 'Kafka体验', '/system/queue-lab/kafka', 'KafkaLabPage', 'DatabaseOutlined', 20),
    ('messaging', 'page', 'queue:rabbitmq', 'RabbitMQ体验', '/system/queue-lab/rabbitmq', 'RabbitMQLabPage', 'MessageOutlined', 21),
    ('messaging', 'page', 'queue:tcp', 'TCP体验', '/system/queue-lab/tcp', 'TCPLabPage', 'ApiOutlined', 22),
    ('messaging', 'page', 'queue:udp', 'UDP体验', '/system/queue-lab/udp', 'UDPLabPage', 'RadarChartOutlined', 23),
    ('messaging', 'page', 'queue:mqtt', 'MQTT体验', '/system/queue-lab/mqtt', 'MQTTLabPage', 'CloudUploadOutlined', 24),
    ('messaging', 'page', 'chat:view', '即时通讯', '/collaboration/chat', 'ChatPage', 'WechatOutlined', 25),
    (NULL, 'directory', 'business', '业务管理', NULL, NULL, 'AppstoreOutlined', 20),
    (NULL, 'page', 'kb:view', '知识库', '/knowledge-base', 'KnowledgeBasePage', 'BookOutlined', 40),
    ('kb:view', 'button', 'kb:update', '维护知识库', NULL, NULL, NULL, 421),
    ('business', 'page', 'customer:view', '客户管理', '/business/customers', 'CustomerListPage', 'ContactsOutlined', 21),
    (NULL, 'directory', 'collaboration', '协同办公', NULL, NULL, 'BranchesOutlined', 30),
    ('collaboration', 'page', 'todo:view', '待办中心', '/collaboration/todos', 'TodoCenterPage', 'ClockCircleOutlined', 30),
    ('collaboration', 'page', 'notification:view', '通知中心', '/collaboration/notifications', 'NotificationCenterPage', 'BellOutlined', 31),
    ('collaboration', 'page', 'message-template:view', '消息模板', '/collaboration/message-templates', 'MessageTemplatePage', 'MessageOutlined', 33),
    ('collaboration', 'page', 'approval:view', '审批中心', '/collaboration/approvals', 'ApprovalCenterPage', 'CheckSquareOutlined', 34),
    ('collaboration', 'page', 'workflow:view', '工作流', '/collaboration/workflows', 'WorkflowPage', 'BranchesOutlined', 35),
    ('collaboration', 'page', 'ai:chat', 'AI助手', '/collaboration/ai-assistant', 'AIAssistantPage', 'RobotOutlined', 36),
    (NULL, 'directory', 'resources', '资源管理', NULL, NULL, 'FolderOutlined', 60),
    ('resources', 'page', 'file:view', '文件中心', '/files', 'FileCenterPage', 'FolderOpenOutlined', 61),
    ('resources', 'page', 'audit:view', '操作日志', '/logs/operation', 'AuditLogPage', 'FileSearchOutlined', 62),
    (NULL, 'page', 'settings:view', '系统设置', '/settings', 'SettingsPage', 'ControlOutlined', 70),
    ('user:view', 'button', 'user:create', '创建用户', NULL, NULL, NULL, 101),
    ('user:view', 'button', 'user:update', '编辑用户', NULL, NULL, NULL, 102),
    ('user:view', 'button', 'user:delete', '删除用户', NULL, NULL, NULL, 103),
    ('role:view', 'button', 'role:create', '创建角色', NULL, NULL, NULL, 104),
    ('role:view', 'button', 'role:update', '编辑角色', NULL, NULL, NULL, 105),
    ('role:view', 'button', 'role:delete', '删除角色', NULL, NULL, NULL, 106),
    ('customer:view', 'button', 'customer:create', '创建客户', NULL, NULL, NULL, 201),
    ('customer:view', 'button', 'customer:update', '编辑客户', NULL, NULL, NULL, 202),
    ('customer:view', 'button', 'customer:delete', '删除客户', NULL, NULL, NULL, 203),
    ('datadict:view', 'button', 'datadict:create', '创建字典', NULL, NULL, NULL, 151),
    ('datadict:view', 'button', 'datadict:update', '编辑字典', NULL, NULL, NULL, 152),
    ('datadict:view', 'button', 'datadict:delete', '删除字典', NULL, NULL, NULL, 153),
    ('recycle:view', 'button', 'recycle:restore', '恢复数据', NULL, NULL, NULL, 161),
    ('recycle:view', 'button', 'recycle:purge', '彻底删除', NULL, NULL, NULL, 162),
    ('scheduler:view', 'button', 'scheduler:create', '创建任务', NULL, NULL, NULL, 181),
    ('scheduler:view', 'button', 'scheduler:update', '编辑任务', NULL, NULL, NULL, 182),
    ('scheduler:view', 'button', 'scheduler:delete', '删除任务', NULL, NULL, NULL, 183),
    ('scheduler:view', 'button', 'scheduler:toggle', '启停任务', NULL, NULL, NULL, 184),
    ('scheduler:view', 'button', 'scheduler:run', '手动执行', NULL, NULL, NULL, 185),
    ('notification:view', 'button', 'notification:create', '创建通知', NULL, NULL, NULL, 501),
    ('message-template:view', 'button', 'message-template:create', '创建模板', NULL, NULL, NULL, 510),
    ('message-template:view', 'button', 'message-template:update', '编辑模板', NULL, NULL, NULL, 511),
    ('message-template:view', 'button', 'message-template:delete', '删除模板', NULL, NULL, NULL, 512),
    ('approval:view', 'button', 'approval:submit', '提交审批', NULL, NULL, NULL, 523),
    ('approval:view', 'button', 'approval:action', '处理审批', NULL, NULL, NULL, 524),
    ('workflow:view', 'button', 'workflow:update', '编辑工作流', NULL, NULL, NULL, 531),
    ('workflow:view', 'button', 'workflow:run', '运行工作流', NULL, NULL, NULL, 532),
    ('workflow:view', 'button', 'workflow:delete', '删除工作流', NULL, NULL, NULL, 533),
    ('ai:chat', 'button', 'ai:send', '发送消息', NULL, NULL, NULL, 541),
    ('file:view', 'button', 'file:upload', '上传文件', NULL, NULL, NULL, 301),
    ('file:view', 'button', 'file:delete', '删除文件', NULL, NULL, NULL, 302),
    ('settings:view', 'button', 'settings:update', '修改配置', NULL, NULL, NULL, 401)
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

const seedDemoApproverRoleMenusSQL = `
WITH approver_roles AS (
  SELECT id FROM sys_roles WHERE code IN ('DEPT_MANAGER', 'HR_MANAGER', 'CUSTOMER_MANAGER')
),
allowed_menus AS (
  SELECT id FROM sys_menus
  WHERE code IN ('dashboard', 'todo:view', 'approval:view', 'approval:action', 'notification:view')
    AND deleted_at IS NULL
)
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT r.id, m.id, 'ALL'
FROM approver_roles r
CROSS JOIN allowed_menus m
ON CONFLICT DO NOTHING;`
