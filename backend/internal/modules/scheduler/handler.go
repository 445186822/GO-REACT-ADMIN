package scheduler

import (
	"net/http"
	"strconv"
	"time"

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
	group := g.Group("/scheduler", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("/tasks", h.ListTasks)
	group.POST("/tasks", h.CreateTask)
	group.PUT("/tasks/:id", h.UpdateTask)
	group.DELETE("/tasks/:id", h.DeleteTask)
	group.POST("/tasks/:id/toggle", h.ToggleTask)
	group.POST("/tasks/:id/run", h.RunTask)
	group.GET("/tasks/:id/executions", h.ListExecutions)
}

type TaskRow struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	CronExpr  string  `json:"cron_expr"`
	TaskType  string  `json:"task_type"`
	Config    *string `json:"config"`
	Enabled   bool    `json:"enabled"`
	LastRunAt *string `json:"last_run_at"`
	NextRunAt *string `json:"next_run_at"`
	Remark    *string `json:"remark"`
	CreatedAt string  `json:"created_at"`
}

type TaskForm struct {
	Name     string  `json:"name"`
	CronExpr string  `json:"cron_expr"`
	TaskType string  `json:"task_type"`
	Config   *string `json:"config"`
	Remark   *string `json:"remark"`
}

func (h *Handler) ListTasks(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize

	var total int64
	h.db.QueryRow(c.Request().Context(),
		`SELECT count(*) FROM sys_scheduled_tasks WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')`, keyword).Scan(&total)

	rows, err := h.db.Query(c.Request().Context(),
		`SELECT id, name, cron_expr, task_type, config::text, enabled,
		 COALESCE(to_char(last_run_at, 'YYYY-MM-DD HH24:MI:SS'), ''),
		 COALESCE(to_char(next_run_at, 'YYYY-MM-DD HH24:MI:SS'), ''),
		 remark, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS')
		 FROM sys_scheduled_tasks
		 WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, keyword, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]TaskRow, 0)
	for rows.Next() {
		var item TaskRow
		var lastRun, nextRun string
		if err := rows.Scan(&item.ID, &item.Name, &item.CronExpr, &item.TaskType, &item.Config, &item.Enabled,
			&lastRun, &nextRun, &item.Remark, &item.CreatedAt); err != nil {
			return err
		}
		if lastRun != "" {
			item.LastRunAt = &lastRun
		}
		if nextRun != "" {
			item.NextRunAt = &nextRun
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, response.Page[TaskRow]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) CreateTask(c echo.Context) error {
	var req TaskForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Name == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
	}
	if req.TaskType == "" {
		req.TaskType = "CUSTOM"
	}
	var id int64
	err := h.db.QueryRow(c.Request().Context(),
		`INSERT INTO sys_scheduled_tasks (name, cron_expr, task_type, config, remark) VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING id`,
		req.Name, req.CronExpr, req.TaskType, req.Config, req.Remark).Scan(&id)
	if err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateTask(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req TaskForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	tag, err := h.db.Exec(c.Request().Context(),
		`UPDATE sys_scheduled_tasks SET name=$2, cron_expr=$3, task_type=$4, config=$5::jsonb, remark=$6, updated_at=now() WHERE id=$1`,
		id, req.Name, req.CronExpr, req.TaskType, req.Config, req.Remark)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "task not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteTask(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	h.db.Exec(c.Request().Context(), `DELETE FROM sys_task_executions WHERE task_id = $1`, id)
	h.db.Exec(c.Request().Context(), `DELETE FROM sys_scheduled_tasks WHERE id = $1`, id)
	return response.OK(c, map[string]bool{"deleted": true})
}

func (h *Handler) ToggleTask(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var enabled bool
	h.db.QueryRow(c.Request().Context(), `UPDATE sys_scheduled_tasks SET enabled = NOT enabled, updated_at = now() WHERE id = $1 RETURNING enabled`, id).Scan(&enabled)
	return response.OK(c, map[string]bool{"enabled": enabled})
}

func (h *Handler) RunTask(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "ID 格式错误")
	}

	// Load task
	var taskType, cronExpr, config string
	var taskName string
	err = h.db.QueryRow(c.Request().Context(),
		`SELECT name, COALESCE(cron_expr, ''), task_type, COALESCE(config::text, '{}') FROM sys_scheduled_tasks WHERE id = $1`, id,
	).Scan(&taskName, &cronExpr, &taskType, &config)
	if err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "任务不存在")
	}

	now := time.Now()

	// Insert RUNNING execution record
	var execID int64
	err = h.db.QueryRow(c.Request().Context(),
		`INSERT INTO sys_task_executions (task_id, status, started_at) VALUES ($1, 'RUNNING', $2) RETURNING id`, id, now).Scan(&execID)
	if err != nil {
		return err
	}

	// Actually execute the task
	output, execErr := executeTask(c.Request().Context(), h.db, taskType, config)

	finishTime := time.Now()
	status := "SUCCESS"
	var errMsg *string
	if execErr != nil {
		status = "FAILED"
		msg := execErr.Error()
		errMsg = &msg
	}

	// Update execution record
	_, err = h.db.Exec(c.Request().Context(),
		`UPDATE sys_task_executions SET status = $2, finished_at = $3, output = $4, error_message = $5 WHERE id = $1`,
		execID, status, finishTime, output, errMsg)
	if err != nil {
		return err
	}

	// Update task's last_run_at and next_run_at
	nextRun := nextCronTime(cronExpr, now)
	_, _ = h.db.Exec(c.Request().Context(),
		`UPDATE sys_scheduled_tasks SET last_run_at = $2, next_run_at = $3, updated_at = now() WHERE id = $1`,
		id, now, nextRun)

	return response.OK(c, map[string]interface{}{
		"execution_id":  execID,
		"status":        status,
		"output":        output,
		"error_message": errMsg,
		"last_run_at":   now.Format("2006-01-02 15:04:05"),
		"next_run_at":   nextRun.Format("2006-01-02 15:04:05"),
	})
}

type ExecutionRow struct {
	ID           int64   `json:"id"`
	TaskID       int64   `json:"task_id"`
	Status       string  `json:"status"`
	StartedAt    string  `json:"started_at"`
	FinishedAt   *string `json:"finished_at"`
	Output       *string `json:"output"`
	ErrorMessage *string `json:"error_message"`
}

func (h *Handler) ListExecutions(c echo.Context) error {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize

	var total int64
	h.db.QueryRow(c.Request().Context(),
		`SELECT count(*) FROM sys_task_executions WHERE task_id = $1`, taskID).Scan(&total)

	rows, err := h.db.Query(c.Request().Context(),
		`SELECT id, task_id, status, to_char(started_at, 'YYYY-MM-DD HH24:MI:SS'),
		 COALESCE(to_char(finished_at, 'YYYY-MM-DD HH24:MI:SS'), ''), output, error_message
		 FROM sys_task_executions WHERE task_id = $1
		 ORDER BY started_at DESC LIMIT $2 OFFSET $3`, taskID, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]ExecutionRow, 0)
	for rows.Next() {
		var item ExecutionRow
		var finished string
		if err := rows.Scan(&item.ID, &item.TaskID, &item.Status, &item.StartedAt, &finished, &item.Output, &item.ErrorMessage); err != nil {
			return err
		}
		if finished != "" {
			item.FinishedAt = &finished
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, response.Page[ExecutionRow]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func pagination(c echo.Context) (int64, int64) {
	page, _ := strconv.ParseInt(c.QueryParam("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.QueryParam("page_size"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}
