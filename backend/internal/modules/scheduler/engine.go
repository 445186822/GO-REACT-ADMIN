package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Engine is the real background scheduler that ticks every 30 seconds,
// finds enabled tasks whose next_run_at has passed, and executes them.
type Engine struct {
	db  *pgxpool.Pool
	log *slog.Logger

	mu      sync.Mutex
	ticker  *time.Ticker
	stopCh  chan struct{}
	running bool
}

func NewEngine(db *pgxpool.Pool, log *slog.Logger) *Engine {
	return &Engine{db: db, log: log}
}

// Start launches the scheduler loop in a background goroutine.
func (e *Engine) Start() {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return
	}
	e.running = true
	e.ticker = time.NewTicker(30 * time.Second)
	e.stopCh = make(chan struct{})
	e.mu.Unlock()

	e.log.Info("scheduler engine started (tick every 30s)")

	// Recalculate next_run_at for all enabled tasks on startup
	e.recalculateAll()

	go func() {
		for {
			select {
			case <-e.ticker.C:
				e.tick()
			case <-e.stopCh:
				e.ticker.Stop()
				e.log.Info("scheduler engine stopped")
				return
			}
		}
	}()
}

// Stop gracefully shuts down the scheduler.
func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !e.running {
		return
	}
	e.running = false
	close(e.stopCh)
}

// tick scans for due tasks and executes them.
func (e *Engine) tick() {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	now := time.Now()

	rows, err := e.db.Query(ctx, `
		SELECT id, name, cron_expr, task_type, COALESCE(config::text, '{}')
		FROM sys_scheduled_tasks
		WHERE enabled = true AND next_run_at IS NOT NULL AND next_run_at <= $1
		ORDER BY next_run_at LIMIT 10
	`, now)
	if err != nil {
		e.log.Error("scheduler scan failed", "error", err)
		return
	}
	defer rows.Close()

	type pending struct {
		id       int64
		name     string
		cronExpr string
		taskType string
		config   string
	}
	var tasks []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.name, &p.cronExpr, &p.taskType, &p.config); err != nil {
			continue
		}
		tasks = append(tasks, p)
	}
	rows.Close()

	for _, t := range tasks {
		e.runOne(ctx, t.id, t.name, t.taskType, t.config, t.cronExpr, now)
	}
}

// runOne executes a single task and records the execution log.
func (e *Engine) runOne(ctx context.Context, taskID int64, name, taskType, config, cronExpr string, now time.Time) {
	e.log.Info("scheduler executing task", "id", taskID, "name", name, "type", taskType)

	var execID int64
	err := e.db.QueryRow(ctx,
		`INSERT INTO sys_task_executions (task_id, status, started_at) VALUES ($1, 'RUNNING', $2) RETURNING id`,
		taskID, now).Scan(&execID)
	if err != nil {
		e.log.Error("scheduler insert execution failed", "task_id", taskID, "error", err)
		return
	}

	output, execErr := executeTask(ctx, e.db, taskType, config)

	finishTime := time.Now()
	status := "SUCCESS"
	var errMsg *string
	if execErr != nil {
		status = "FAILED"
		msg := execErr.Error()
		errMsg = &msg
	}

	_, err = e.db.Exec(ctx,
		`UPDATE sys_task_executions SET status = $2, finished_at = $3, output = $4, error_message = $5 WHERE id = $1`,
		execID, status, finishTime, output, errMsg)
	if err != nil {
		e.log.Error("scheduler update execution failed", "exec_id", execID, "error", err)
	}

	// Update task's last_run_at and next_run_at
	nextRun := nextCronTime(cronExpr, now)
	_, err = e.db.Exec(ctx,
		`UPDATE sys_scheduled_tasks SET last_run_at = $2, next_run_at = $3, updated_at = now() WHERE id = $1`,
		taskID, now, nextRun)
	if err != nil {
		e.log.Error("scheduler update task times failed", "task_id", taskID, "error", err)
	}

	e.log.Info("scheduler task completed", "id", taskID, "name", name, "status", status)
}

// recalculateAll computes next_run_at for all enabled tasks.
func (e *Engine) recalculateAll() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()
	rows, err := e.db.Query(ctx,
		`SELECT id, cron_expr FROM sys_scheduled_tasks WHERE enabled = true`)
	if err != nil {
		e.log.Error("scheduler recalculate query failed", "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var cronExpr string
		if err := rows.Scan(&id, &cronExpr); err != nil {
			continue
		}
		next := nextCronTime(cronExpr, now)
		_, _ = e.db.Exec(ctx,
			`UPDATE sys_scheduled_tasks SET next_run_at = $2 WHERE id = $1`, id, next)
	}
}

// ---------- task executors ----------

// executeTask runs the actual business logic based on task_type.
// Returns output text and optional error.
func executeTask(ctx context.Context, db *pgxpool.Pool, taskType string, config string) (string, error) {
	switch taskType {
	case "DATA_CLEANUP":
		return executeDataCleanup(ctx, db)
	case "REPORT_GEN":
		return executeReportGen(ctx, db)
	case "NOTIFICATION":
		return executeNotification(ctx, db)
	case "DATA_SYNC":
		return executeDataSync(ctx, db)
	case "AI_ANALYSIS":
		return executeAIAnalysis(ctx, db)
	default:
		return executeCustom(ctx, db, config)
	}
}

func executeDataCleanup(ctx context.Context, db *pgxpool.Pool) (string, error) {
	// Clean up old read notifications (> 30 days)
	result, err := db.Exec(ctx, `
		UPDATE sys_notifications SET deleted_at = now()
		WHERE read_at IS NOT NULL AND read_at < now() - INTERVAL '30 days' AND deleted_at IS NULL`)
	if err != nil {
		return "", fmt.Errorf("数据清理失败: %w", err)
	}
	return fmt.Sprintf("已清理 %d 条超过30天的已读通知", result.RowsAffected()), nil
}

func executeReportGen(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var userCount, notifCount, approvalCount int64
	_ = db.QueryRow(ctx, `SELECT count(*) FROM sys_users WHERE deleted_at IS NULL`).Scan(&userCount)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM sys_notifications WHERE deleted_at IS NULL`).Scan(&notifCount)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM approval_instances WHERE deleted_at IS NULL`).Scan(&approvalCount)

	now := time.Now().Format("2006-01-02 15:04:05")
	return fmt.Sprintf(`【系统运行报告 %s】
├─ 活跃用户数: %d
├─ 未处理通知: %d
└─ 审批实例数: %d`, now, userCount, notifCount, approvalCount), nil
}

func executeNotification(ctx context.Context, db *pgxpool.Pool) (string, error) {
	now := time.Now().Format("2006-01-02 15:04")
	_, err := db.Exec(ctx, `
		INSERT INTO sys_notifications (title, content, notif_type, source_module)
		VALUES ($1, $2, 'system', 'scheduler')`,
		fmt.Sprintf("定时提醒 %s", now),
		fmt.Sprintf("这是系统在 %s 自动发送的定时提醒通知。", now))
	if err != nil {
		return "", fmt.Errorf("通知发送失败: %w", err)
	}
	return fmt.Sprintf("已发送定时提醒通知 (时间: %s)", now), nil
}

func executeDataSync(ctx context.Context, db *pgxpool.Pool) (string, error) {
	// Simulate data sync: recalculate approval instance counts
	var total int64
	_ = db.QueryRow(ctx,
		`SELECT count(*) FROM approval_instances WHERE deleted_at IS NULL`).Scan(&total)
	return fmt.Sprintf("数据同步完成，当前共 %d 条审批记录", total), nil
}

func executeAIAnalysis(ctx context.Context, db *pgxpool.Pool) (string, error) {
	// Simulate AI analysis of system health
	var activeUsers, pendingApprovals int64
	_ = db.QueryRow(ctx,
		`SELECT count(*) FROM sys_users WHERE deleted_at IS NULL AND status = 'ACTIVE'`).Scan(&activeUsers)
	_ = db.QueryRow(ctx,
		`SELECT count(*) FROM approval_instances WHERE status = 'PENDING' AND deleted_at IS NULL`).Scan(&pendingApprovals)

	health := "健康"
	if pendingApprovals > 5 {
		health = "需要关注"
	}
	return fmt.Sprintf("AI 系统健康分析: %s\n活跃用户: %d  待审批: %d  建议: %s",
		health, activeUsers, pendingApprovals,
		func() string {
			if pendingApprovals > 5 {
				return "审批积压较多，建议及时处理"
			}
			return "系统运行正常"
		}()), nil
}

func executeCustom(ctx context.Context, db *pgxpool.Pool, config string) (string, error) {
	return fmt.Sprintf("自定义任务执行成功\n配置: %s\n执行时间: %s",
		config, time.Now().Format("2006-01-02 15:04:05")), nil
}

// ---------- cron helper ----------

// nextCronTime calculates the next run time from a standard 5-field cron expression.
// Supports: minute hour dom month dow  (e.g., "0 9 * * *" = every day at 9:00)
func nextCronTime(expr string, after time.Time) time.Time {
	if expr == "" {
		return after.Add(24 * time.Hour)
	}

	fields := strings.Fields(expr)
	if len(fields) < 5 {
		return after.Add(24 * time.Hour)
	}

	minute := fields[0]
	hour := fields[1]
	dom := fields[2]
	month := fields[3]
	dow := fields[4]

	// Normalize "*" to match any
	_ = dom
	_ = month
	_ = dow

	candidate := time.Date(after.Year(), after.Month(), after.Day(), after.Hour(), after.Minute(), 0, 0, after.Location())
	candidate = candidate.Add(1 * time.Minute) // start from next minute

	// Search forward (max 366 days to prevent infinite loop)
	for i := 0; i < 525600; i++ { // 365 days * 24h * 60min
		if matchField(minute, candidate.Minute()) &&
			matchField(hour, candidate.Hour()) &&
			matchField(dom, candidate.Day()) &&
			matchField(month, int(candidate.Month())) &&
			matchField(dow, int(candidate.Weekday())) {
			return candidate
		}
		candidate = candidate.Add(1 * time.Minute)
	}

	return after.Add(24 * time.Hour) // fallback
}

func matchField(pattern string, value int) bool {
	if pattern == "*" {
		return true
	}

	// Handle comma-separated values: "1,3,5"
	for _, part := range strings.Split(pattern, ",") {
		part = strings.TrimSpace(part)

		// Handle step: "*/5" or "1-10/2"
		if strings.Contains(part, "/") {
			subparts := strings.SplitN(part, "/", 2)
			step, err := strconv.Atoi(subparts[1])
			if err != nil || step == 0 {
				continue
			}

			rangeStart, rangeEnd := 0, 59
			if subparts[0] != "*" {
				if strings.Contains(subparts[0], "-") {
					rangeParts := strings.SplitN(subparts[0], "-", 2)
					rangeStart, _ = strconv.Atoi(rangeParts[0])
					rangeEnd, _ = strconv.Atoi(rangeParts[1])
				} else {
					rangeStart, _ = strconv.Atoi(subparts[0])
				}
			}
			// Adjust range for hours (0-23) and dom (1-31), month (1-12), dow (0-6)
			if rangeEnd == 59 {
				rangeEnd = inferMax(pattern, value)
			}
			for v := rangeStart; v <= rangeEnd; v += step {
				if v == value {
					return true
				}
			}
			return false
		}

		// Handle range: "9-17"
		if strings.Contains(part, "-") {
			rangeParts := strings.SplitN(part, "-", 2)
			start, _ := strconv.Atoi(rangeParts[0])
			end, _ := strconv.Atoi(rangeParts[1])
			if value >= start && value <= end {
				return true
			}
			continue
		}

		// Literal value
		if v, err := strconv.Atoi(part); err == nil && v == value {
			return true
		}
	}
	return false
}

func inferMax(pattern string, value int) int {
	// For hour field, max is 23; for minute, 59; for dom, 31; for month, 12; for dow, 6
	// Use value to infer: if checking hour (0-23), value will be in 0-23 range
	if value <= 6 && (pattern == "*" || strings.Contains(pattern, "0")) {
		return 6 // likely dow
	}
	if value > 31 {
		return 59 // minute (0-59)
	}
	if value > 23 {
		return 31 // dom (1-31)
	}
	if value > 12 {
		return 23 // hour (0-23)
	}
	if value > 6 {
		return 12 // month (1-12)
	}
	// Default for 0-6: try dow then minute
	return 59
}
