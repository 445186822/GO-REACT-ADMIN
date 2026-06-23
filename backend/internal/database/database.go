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

	if _, err := tx.Exec(ctx, seedMenusSQL); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
UPDATE sys_menus
SET deleted_at = now(), updated_at = now()
WHERE code IN ('order:view', 'task:view', 'workflow', 'approval:view', 'realtime', 'notification:view', 'ai', 'ai:chat')
  AND deleted_at IS NULL`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT 1, id, 'ALL' FROM sys_menus WHERE deleted_at IS NULL ON CONFLICT DO NOTHING`); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

const seedMenusSQL = `
INSERT INTO sys_menus (id, parent_id, type, code, name, path, component, icon, sort_order)
VALUES
  (1, NULL, 'page', 'dashboard', 'Dashboard', '/dashboard', 'DashboardPage', 'DashboardOutlined', 1),
  (10, NULL, 'directory', 'system', 'System Management', NULL, NULL, 'SettingOutlined', 10),
  (11, 10, 'page', 'user:view', 'Users', '/system/users', 'UserListPage', 'UserOutlined', 11),
  (12, 10, 'page', 'role:view', 'Roles', '/system/roles', 'RoleListPage', 'TeamOutlined', 12),
  (13, 10, 'page', 'menu:view', 'Menus', '/system/menus', 'MenuListPage', 'MenuOutlined', 13),
  (14, 10, 'page', 'department:view', 'Departments', '/system/departments', 'DepartmentListPage', 'ApartmentOutlined', 14),
  (20, NULL, 'directory', 'business', 'Business', NULL, NULL, 'AppstoreOutlined', 20),
  (21, 20, 'page', 'customer:view', 'Customers', '/business/customers', 'CustomerListPage', 'ContactsOutlined', 21),
  (60, NULL, 'directory', 'resources', 'Resources', NULL, NULL, 'FolderOutlined', 60),
  (61, 60, 'page', 'file:view', 'Files', '/files', 'FileCenterPage', 'FolderOpenOutlined', 61),
  (62, 60, 'page', 'audit:view', 'Audit Logs', '/logs/operation', 'AuditLogPage', 'FileSearchOutlined', 62),
  (70, NULL, 'page', 'settings:view', 'Settings', '/settings', 'SettingsPage', 'ControlOutlined', 70),
  (101, 11, 'button', 'user:create', 'Create User', NULL, NULL, NULL, 101),
  (102, 11, 'button', 'user:update', 'Update User', NULL, NULL, NULL, 102),
  (103, 11, 'button', 'user:delete', 'Delete User', NULL, NULL, NULL, 103),
  (201, 21, 'button', 'customer:create', 'Create Customer', NULL, NULL, NULL, 201),
  (202, 21, 'button', 'customer:update', 'Update Customer', NULL, NULL, NULL, 202),
  (203, 21, 'button', 'customer:delete', 'Delete Customer', NULL, NULL, NULL, 203),
  (301, 61, 'button', 'file:upload', 'Upload File', NULL, NULL, NULL, 301),
  (302, 61, 'button', 'file:delete', 'Delete File', NULL, NULL, NULL, 302),
  (401, 70, 'button', 'settings:update', 'Update Settings', NULL, NULL, NULL, 401)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  component = EXCLUDED.component,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  deleted_at = NULL;`
