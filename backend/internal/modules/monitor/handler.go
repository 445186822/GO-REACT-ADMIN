package monitor

import (
	"runtime"
	"time"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	db        *pgxpool.Pool
	jwtSecret string
	startTime time.Time
}

func NewHandler(db *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret, startTime: time.Now()}
}

func (h *Handler) Register(g *echo.Group) {
	group := g.Group("/monitor", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("/overview", h.Overview)
	group.GET("/db-stats", h.DBStats)
}

type OverviewData struct {
	GoVersion    string `json:"go_version"`
	NumCPU       int    `json:"num_cpu"`
	NumGoroutine int    `json:"num_goroutine"`
	MemAllocMB   int64  `json:"mem_alloc_mb"`
	MemTotalMB   int64  `json:"mem_total_mb"`
	UptimeHours  int64  `json:"uptime_hours"`
	UptimeStr    string `json:"uptime_str"`
}

func (h *Handler) Overview(c echo.Context) error {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	uptime := time.Since(h.startTime)

	return response.OK(c, OverviewData{
		GoVersion:    runtime.Version(),
		NumCPU:       runtime.NumCPU(),
		NumGoroutine: runtime.NumGoroutine(),
		MemAllocMB:   int64(mem.Alloc / 1024 / 1024),
		MemTotalMB:   int64(mem.Sys / 1024 / 1024),
		UptimeHours:  int64(uptime.Hours()),
		UptimeStr:    uptime.Round(time.Second).String(),
	})
}

type DBStatsData struct {
	Version       string `json:"version"`
	ActiveConns   int32  `json:"active_conns"`
	MaxConns      int32  `json:"max_conns"`
	DBSizeMB      int64  `json:"db_size_mb"`
	TableCount    int64  `json:"table_count"`
	TotalRequests int64  `json:"total_requests"`
	TodayRequests int64  `json:"today_requests"`
	AvgLatencyMs  int64  `json:"avg_latency_ms"`
	UserCount     int64  `json:"user_count"`
	CustomerCount int64  `json:"customer_count"`
}

func (h *Handler) DBStats(c echo.Context) error {
	ctx := c.Request().Context()
	stats := h.db.Stat()

	data := DBStatsData{
		ActiveConns: stats.AcquiredConns(),
		MaxConns:    stats.MaxConns(),
	}

	// DB version
	h.db.QueryRow(ctx, `SELECT version()`).Scan(&data.Version)

	// DB size
	h.db.QueryRow(ctx,
		`SELECT COALESCE(pg_database_size(current_database()), 0) / 1024 / 1024`).Scan(&data.DBSizeMB)

	// Table count
	h.db.QueryRow(ctx,
		`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`).Scan(&data.TableCount)

	// Total requests
	h.db.QueryRow(ctx, `SELECT COALESCE(count(*), 0) FROM sys_audit_logs`).Scan(&data.TotalRequests)

	// Today requests
	h.db.QueryRow(ctx, `SELECT COALESCE(count(*), 0) FROM sys_audit_logs WHERE created_at >= CURRENT_DATE`).Scan(&data.TodayRequests)

	// Avg latency
	h.db.QueryRow(ctx,
		`SELECT COALESCE(AVG(COALESCE((detail::jsonb->>'latency_ms')::bigint, 0)), 0)::bigint FROM sys_audit_logs WHERE created_at >= CURRENT_DATE`).Scan(&data.AvgLatencyMs)

	// User count
	h.db.QueryRow(ctx, `SELECT COALESCE(count(*), 0) FROM sys_users WHERE deleted_at IS NULL`).Scan(&data.UserCount)
	h.db.QueryRow(ctx, `SELECT COALESCE(count(*), 0) FROM biz_customers WHERE deleted_at IS NULL`).Scan(&data.CustomerCount)

	return response.OK(c, data)
}
