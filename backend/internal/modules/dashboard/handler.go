package dashboard

import (
	"context"
	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	db        *pgxpool.Pool
	jwtSecret string
}

func NewHandler(db *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

func (h *Handler) Register(g *echo.Group) {
	group := g.Group("/dashboard", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("/stats", h.Stats)
}

type TrendPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type LevelDistItem struct {
	Level string `json:"level"`
	Count int64  `json:"count"`
}

type StatusDistItem struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

type DashboardStats struct {
	UserCount          int64            `json:"user_count"`
	CustomerCount      int64            `json:"customer_count"`
	TodayRequests      int64            `json:"today_requests"`
	PendingApprovals   int64            `json:"pending_approvals"`
	RunningTasks       int64            `json:"running_tasks"`
	PendingTodos       int64            `json:"pending_todos"`
	RequestTrend       []TrendPoint     `json:"request_trend"`
	CustomerLevelDist  []LevelDistItem  `json:"customer_level_dist"`
	ApprovalStatusDist []StatusDistItem `json:"approval_status_dist"`
}

func (h *Handler) Stats(c echo.Context) error {
	ctx := c.Request().Context()
	var stats DashboardStats

	if err := h.db.QueryRow(ctx, `SELECT count(*) FROM sys_users WHERE deleted_at IS NULL`).Scan(&stats.UserCount); err != nil {
		return err
	}

	if err := h.db.QueryRow(ctx, `SELECT count(*) FROM biz_customers WHERE deleted_at IS NULL`).Scan(&stats.CustomerCount); err != nil {
		return err
	}

	if err := h.db.QueryRow(ctx, `SELECT count(*) FROM sys_audit_logs WHERE created_at >= CURRENT_DATE`).Scan(&stats.TodayRequests); err != nil {
		return err
	}

	if err := h.db.QueryRow(ctx, `SELECT count(*) FROM approval_instances WHERE status = 'PENDING' AND deleted_at IS NULL`).Scan(&stats.PendingApprovals); err != nil {
		return err
	}

	if err := h.db.QueryRow(ctx, `SELECT count(*) FROM sys_scheduled_tasks WHERE enabled = true`).Scan(&stats.RunningTasks); err != nil {
		return err
	}

	pendingTodos, err := h.countPendingTodos(ctx, middleware.CurrentUserID(c), middleware.ActiveRoleCode(c))
	if err != nil {
		return err
	}
	stats.PendingTodos = pendingTodos

	// Request trend: last 7 days
	{
		rows, err := h.db.Query(ctx, `SELECT to_char(created_at, 'YYYY-MM-DD') as date, count(*) as cnt FROM sys_audit_logs WHERE created_at >= CURRENT_DATE - interval '6 days' GROUP BY date ORDER BY date`)
		if err != nil {
			return err
		}
		defer rows.Close()
		stats.RequestTrend = make([]TrendPoint, 0)
		for rows.Next() {
			var tp TrendPoint
			if err := rows.Scan(&tp.Date, &tp.Count); err != nil {
				return err
			}
			stats.RequestTrend = append(stats.RequestTrend, tp)
		}
	}

	// Customer level distribution
	{
		rows, err := h.db.Query(ctx, `SELECT level, count(*) as cnt FROM biz_customers WHERE deleted_at IS NULL GROUP BY level`)
		if err != nil {
			return err
		}
		defer rows.Close()
		stats.CustomerLevelDist = make([]LevelDistItem, 0)
		for rows.Next() {
			var ld LevelDistItem
			if err := rows.Scan(&ld.Level, &ld.Count); err != nil {
				return err
			}
			stats.CustomerLevelDist = append(stats.CustomerLevelDist, ld)
		}
	}

	// Approval status distribution
	{
		rows, err := h.db.Query(ctx, `SELECT status, count(*) as cnt FROM approval_instances WHERE deleted_at IS NULL GROUP BY status`)
		if err != nil {
			return err
		}
		defer rows.Close()
		stats.ApprovalStatusDist = make([]StatusDistItem, 0)
		for rows.Next() {
			var sd StatusDistItem
			if err := rows.Scan(&sd.Status, &sd.Count); err != nil {
				return err
			}
			stats.ApprovalStatusDist = append(stats.ApprovalStatusDist, sd)
		}
	}

	return response.OK(c, stats)
}

func (h *Handler) countPendingTodos(ctx context.Context, userID int64, activeRole string) (int64, error) {
	roles, err := h.currentUserRoleLabels(ctx, userID, activeRole)
	if err != nil {
		return 0, err
	}
	if len(roles) == 0 {
		return 0, nil
	}

	var count int64
	err = h.db.QueryRow(ctx, `
SELECT count(*)
FROM approval_instance_nodes ain
JOIN approval_instances ai ON ai.id = ain.instance_id AND ai.deleted_at IS NULL
WHERE ai.status = 'PENDING'
  AND ain.status = 'RUNNING'
  AND ain.node_type = 'approval'
  AND (btrim(ain.assignee) = '' OR ain.assignee = ANY($1))`, roles).Scan(&count)
	return count, err
}

func (h *Handler) currentUserRoleLabels(ctx context.Context, userID int64, activeRole string) ([]string, error) {
	rows, err := h.db.Query(ctx, `
SELECT r.code, r.name
FROM sys_roles r
JOIN sys_user_roles ur ON ur.role_id = r.id
WHERE ur.user_id = $1
  AND ($2 = '' OR lower(r.code) = lower($2) OR lower(r.name) = lower($2))
  AND r.deleted_at IS NULL
  AND r.status = 'ACTIVE'`, userID, activeRole)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roles := make([]string, 0)
	for rows.Next() {
		var code, name string
		if err := rows.Scan(&code, &name); err != nil {
			return nil, err
		}
		roles = append(roles, code, name, "role:"+code, "role:"+name)
	}
	return roles, rows.Err()
}
