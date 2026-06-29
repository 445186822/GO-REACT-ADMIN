package collaboration

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"enterprise-demo/backend/internal/auth"
	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	db        *pgxpool.Pool
	jwtSecret string
	hub       *notificationHub
}

func NewHandler(db *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret, hub: newNotificationHub()}
}

func (h *Handler) Register(g *echo.Group) {
	authGroup := g.Group("", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	authGroup.GET("/todos", h.ListTodos)
	authGroup.GET("/notifications", h.ListNotifications)
	authGroup.POST("/notifications", h.CreateNotification)
	authGroup.GET("/notifications/unread-count", h.UnreadCount)
	authGroup.PUT("/notifications/:id/read", h.MarkNotificationRead)
	authGroup.PUT("/notifications/read-all", h.MarkAllNotificationsRead)

	authGroup.GET("/message-templates", h.ListMessageTemplates)
	authGroup.POST("/message-templates", h.CreateMessageTemplate)
	authGroup.PUT("/message-templates/:id", h.UpdateMessageTemplate)
	authGroup.DELETE("/message-templates/:id", h.DeleteMessageTemplate)

	authGroup.GET("/approval/instances", h.ListApprovalInstances)
	authGroup.POST("/approval/instances", h.SubmitApproval)
	authGroup.GET("/approval/instances/:id", h.GetApprovalInstance)
	authGroup.POST("/approval/instances/:id/action", h.ActionApproval)

	authGroup.GET("/workflows", h.ListWorkflows)
	authGroup.POST("/workflows", h.CreateWorkflow)
	authGroup.PUT("/workflows/:id", h.UpdateWorkflow)
	authGroup.DELETE("/workflows/:id", h.DeleteWorkflow)
	authGroup.POST("/workflows/:id/run", h.RunWorkflow)
	authGroup.GET("/workflows/instances", h.ListWorkflowInstances)
	authGroup.GET("/workflows/instances/:id", h.GetWorkflowInstance)
	authGroup.GET("/ai-assistant/messages", h.ListAIMessages)
	authGroup.POST("/ai-assistant/chat", h.ChatAI)
	h.registerAIRoutes(g)

	g.GET("/notifications/ws", h.NotificationWS)
}

type NotificationRow struct {
	ID           int64      `json:"id"`
	Title        string     `json:"title"`
	Content      string     `json:"content"`
	NotifType    string     `json:"notif_type"`
	SourceModule string     `json:"source_module"`
	RecipientID  *int64     `json:"recipient_id"`
	ReadAt       *time.Time `json:"read_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

type NotificationRequest struct {
	Title        string `json:"title"`
	Content      string `json:"content"`
	NotifType    string `json:"notif_type"`
	SourceModule string `json:"source_module"`
	RecipientID  *int64 `json:"recipient_id"`
}

type TodoRow struct {
	ID              int64      `json:"id"`
	SourceModule    string     `json:"source_module"`
	SourceID        int64      `json:"source_id"`
	Title           string     `json:"title"`
	BizType         string     `json:"biz_type"`
	BizID           *string    `json:"biz_id"`
	Applicant       string     `json:"applicant"`
	CurrentStep     int        `json:"current_step"`
	CurrentStepName string     `json:"current_step_name"`
	Assignee        string     `json:"assignee"`
	CreatedAt       time.Time  `json:"created_at"`
	TodoStatus      string     `json:"todo_status"`
	ApprovalStatus  string     `json:"approval_status,omitempty"`
	Action          *string    `json:"action,omitempty"`
	ActionAt        *time.Time `json:"action_at,omitempty"`
}

func (h *Handler) ListTodos(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	if c.QueryParam("scope") == "done" {
		items, err := h.listDoneTodos(c.Request().Context(), userID)
		if err != nil {
			return err
		}
		return response.OK(c, items)
	}
	roles, err := h.currentUserRoleLabels(c.Request().Context(), userID)
	if err != nil {
		return err
	}
	rows, err := h.db.Query(c.Request().Context(), `
SELECT ai.id, ai.title, ai.biz_type, ai.biz_id, u.display_name, ai.current_step, ai.created_at,
       wd.definition
FROM approval_instances ai
JOIN sys_users u ON u.id = ai.applicant_id
JOIN workflow_definitions wd ON wd.id = ai.workflow_definition_id AND wd.deleted_at IS NULL AND wd.status = 'ACTIVE'
WHERE ai.deleted_at IS NULL AND ai.status = 'PENDING'
ORDER BY ai.created_at DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]TodoRow, 0)
	for rows.Next() {
		var (
			id          int64
			title       string
			bizType     string
			bizID       *string
			applicant   string
			currentStep int
			createdAt   time.Time
			definition  json.RawMessage
		)
		if err := rows.Scan(&id, &title, &bizType, &bizID, &applicant, &currentStep, &createdAt, &definition); err != nil {
			return err
		}
		runtimeSteps := approvalRuntimeSteps(definition)
		if currentStep >= len(runtimeSteps) {
			continue
		}
		step := runtimeSteps[currentStep]
		if !assigneeMatchesRoles(step.Assignee, roles) {
			continue
		}
		items = append(items, TodoRow{
			ID:              id,
			SourceModule:    "approval",
			SourceID:        id,
			Title:           title,
			BizType:         bizType,
			BizID:           bizID,
			Applicant:       applicant,
			CurrentStep:     currentStep,
			CurrentStepName: step.Name,
			Assignee:        step.Assignee,
			CreatedAt:       createdAt,
			TodoStatus:      "pending",
			ApprovalStatus:  "PENDING",
		})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) listDoneTodos(ctx context.Context, userID int64) ([]TodoRow, error) {
	rows, err := h.db.Query(ctx, `
SELECT aa.id, ai.id, ai.title, ai.biz_type, ai.biz_id, u.display_name, ai.current_step, ai.status,
       aa.step_index, aa.action, aa.created_at, wd.definition
FROM approval_actions aa
JOIN approval_instances ai ON ai.id = aa.instance_id AND ai.deleted_at IS NULL
JOIN sys_users u ON u.id = ai.applicant_id
JOIN workflow_definitions wd ON wd.id = ai.workflow_definition_id AND wd.deleted_at IS NULL
WHERE aa.approver_id = $1
ORDER BY aa.created_at DESC, aa.id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TodoRow, 0)
	for rows.Next() {
		var (
			actionID       int64
			instanceID     int64
			title          string
			bizType        string
			bizID          *string
			applicant      string
			currentStep    int
			approvalStatus string
			stepIndex      int
			action         string
			actionAt       time.Time
			definition     json.RawMessage
		)
		if err := rows.Scan(&actionID, &instanceID, &title, &bizType, &bizID, &applicant, &currentStep, &approvalStatus, &stepIndex, &action, &actionAt, &definition); err != nil {
			return nil, err
		}
		runtimeSteps := approvalRuntimeSteps(definition)
		stepName := "第 " + strconv.Itoa(stepIndex+1) + " 步"
		assignee := ""
		if stepIndex >= 0 && stepIndex < len(runtimeSteps) {
			stepName = runtimeSteps[stepIndex].Name
			assignee = runtimeSteps[stepIndex].Assignee
		}
		items = append(items, TodoRow{
			ID:              actionID,
			SourceModule:    "approval",
			SourceID:        instanceID,
			Title:           title,
			BizType:         bizType,
			BizID:           bizID,
			Applicant:       applicant,
			CurrentStep:     currentStep,
			CurrentStepName: stepName,
			Assignee:        assignee,
			CreatedAt:       actionAt,
			TodoStatus:      "done",
			ApprovalStatus:  approvalStatus,
			Action:          &action,
			ActionAt:        &actionAt,
		})
	}
	return items, rows.Err()
}

func (h *Handler) ListNotifications(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize
	onlyMine := c.QueryParam("scope") != "all"

	var total int64
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT count(*) FROM sys_notifications
WHERE deleted_at IS NULL AND ($1 = false OR recipient_id IS NULL OR recipient_id = $2)`, onlyMine, userID).Scan(&total); err != nil {
		return err
	}
	rows, err := h.db.Query(c.Request().Context(), `
SELECT id, title, content, notif_type, source_module, recipient_id, read_at, created_at
FROM sys_notifications
WHERE deleted_at IS NULL AND ($1 = false OR recipient_id IS NULL OR recipient_id = $2)
ORDER BY created_at DESC LIMIT $3 OFFSET $4`, onlyMine, userID, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]NotificationRow, 0)
	for rows.Next() {
		var item NotificationRow
		if err := rows.Scan(&item.ID, &item.Title, &item.Content, &item.NotifType, &item.SourceModule, &item.RecipientID, &item.ReadAt, &item.CreatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, response.Page[NotificationRow]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) CreateNotification(c echo.Context) error {
	var req NotificationRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Title == "" || req.Content == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "标题和内容不能为空")
	}
	if req.NotifType == "" {
		req.NotifType = "system"
	}
	if req.SourceModule == "" {
		req.SourceModule = "system"
	}
	id, err := h.insertNotification(c.Request().Context(), req, middleware.CurrentUserID(c))
	if err != nil {
		return err
	}
	h.broadcastUnread(c.Request().Context(), req.RecipientID)
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UnreadCount(c echo.Context) error {
	count, err := h.unreadCount(c.Request().Context(), middleware.CurrentUserID(c))
	if err != nil {
		return err
	}
	return response.OK(c, map[string]int64{"count": count})
}

func (h *Handler) MarkNotificationRead(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	userID := middleware.CurrentUserID(c)
	_, err = h.db.Exec(c.Request().Context(), `
UPDATE sys_notifications SET read_at = COALESCE(read_at, now())
WHERE id = $1 AND deleted_at IS NULL AND (recipient_id IS NULL OR recipient_id = $2)`, id, userID)
	if err != nil {
		return err
	}
	h.broadcastUnread(c.Request().Context(), &userID)
	return response.OK(c, map[string]bool{"read": true})
}

func (h *Handler) MarkAllNotificationsRead(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	if _, err := h.db.Exec(c.Request().Context(), `
UPDATE sys_notifications SET read_at = COALESCE(read_at, now())
WHERE deleted_at IS NULL AND read_at IS NULL AND (recipient_id IS NULL OR recipient_id = $1)`, userID); err != nil {
		return err
	}
	h.broadcastUnread(c.Request().Context(), &userID)
	return response.OK(c, map[string]bool{"read": true})
}

type TemplateRow struct {
	ID        int64           `json:"id"`
	Code      string          `json:"code"`
	Name      string          `json:"name"`
	Category  string          `json:"category"`
	Subject   string          `json:"subject"`
	Content   string          `json:"content"`
	Variables json.RawMessage `json:"variables"`
	Status    string          `json:"status"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func (h *Handler) ListMessageTemplates(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	category := c.QueryParam("category")
	status := c.QueryParam("status")
	rows, err := h.db.Query(c.Request().Context(), `
SELECT id, code, name, category, subject, content, variables, status, updated_at
FROM msg_templates
WHERE deleted_at IS NULL
  AND ($1 = '' OR code ILIKE '%' || $1 || '%' OR name ILIKE '%' || $1 || '%' OR subject ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%')
  AND ($2 = '' OR category = $2)
  AND ($3 = '' OR status = $3)
ORDER BY updated_at DESC`, keyword, category, status)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]TemplateRow, 0)
	for rows.Next() {
		var item TemplateRow
		if err := rows.Scan(&item.ID, &item.Code, &item.Name, &item.Category, &item.Subject, &item.Content, &item.Variables, &item.Status, &item.UpdatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) CreateMessageTemplate(c echo.Context) error {
	var req TemplateRow
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Code == "" || req.Name == "" || req.Subject == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "编码、名称和标题不能为空")
	}
	if req.Category == "" {
		req.Category = "system_notice"
	}
	if req.Status == "" {
		req.Status = "ACTIVE"
	}
	variables := defaultJSON(req.Variables, "[]")
	var id int64
	if err := h.db.QueryRow(c.Request().Context(), `
INSERT INTO msg_templates (code, name, category, subject, content, variables, status)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
		req.Code, req.Name, req.Category, req.Subject, req.Content, variables, req.Status).Scan(&id); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateMessageTemplate(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	var req TemplateRow
	if err := c.Bind(&req); err != nil {
		return err
	}
	_, err = h.db.Exec(c.Request().Context(), `
UPDATE msg_templates SET name=$2, category=$3, subject=$4, content=$5, variables=$6::jsonb, status=$7, updated_at=now()
WHERE id=$1 AND deleted_at IS NULL`, id, req.Name, req.Category, req.Subject, req.Content, defaultJSON(req.Variables, "[]"), req.Status)
	if err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteMessageTemplate(c echo.Context) error {
	return softDelete(c, h.db, "msg_templates")
}

type ApprovalInstanceRow struct {
	ID          int64               `json:"id"`
	WorkflowID  int64               `json:"workflow_definition_id"`
	Workflow    string              `json:"workflow"`
	Title       string              `json:"title"`
	BizType     string              `json:"biz_type"`
	BizID       *string             `json:"biz_id"`
	Applicant   string              `json:"applicant"`
	Status      string              `json:"status"`
	CurrentStep int                 `json:"current_step"`
	FormData    json.RawMessage     `json:"form_data"`
	CreatedAt   time.Time           `json:"created_at"`
	Actions     []ApprovalActionRow `json:"actions,omitempty"`
	applicantID int64
}

type ApprovalActionRow struct {
	ID        int64     `json:"id"`
	StepIndex int       `json:"step_index"`
	Approver  string    `json:"approver"`
	Action    string    `json:"action"`
	Comment   *string   `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *Handler) ListApprovalInstances(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	bizType := c.QueryParam("biz_type")
	status := c.QueryParam("status")
	rows, err := h.db.Query(c.Request().Context(), `
SELECT ai.id, ai.workflow_definition_id, wd.name, ai.title, ai.biz_type, ai.biz_id, u.display_name, ai.status, ai.current_step, ai.form_data, ai.created_at
FROM approval_instances ai
JOIN workflow_definitions wd ON wd.id = ai.workflow_definition_id
JOIN sys_users u ON u.id = ai.applicant_id
WHERE ai.deleted_at IS NULL
  AND ($1 = '' OR ai.title ILIKE '%' || $1 || '%' OR COALESCE(ai.biz_id, '') ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')
  AND ($2 = '' OR ai.biz_type = $2)
  AND ($3 = '' OR ai.status = $3)
ORDER BY ai.created_at DESC`, keyword, bizType, status)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]ApprovalInstanceRow, 0)
	for rows.Next() {
		var item ApprovalInstanceRow
		if err := rows.Scan(&item.ID, &item.WorkflowID, &item.Workflow, &item.Title, &item.BizType, &item.BizID, &item.Applicant, &item.Status, &item.CurrentStep, &item.FormData, &item.CreatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) SubmitApproval(c echo.Context) error {
	var req ApprovalInstanceRow
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Title == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "标题不能为空")
	}
	if req.WorkflowID == 0 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "请选择审批工作流")
	}
	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()
	workflow, err := resolveApprovalWorkflow(c.Request().Context(), tx, req.WorkflowID)
	if err != nil {
		return err
	}
	if req.BizType == "" {
		req.BizType = workflow.Category
	}
	var id int64
	if err := tx.QueryRow(c.Request().Context(), `
INSERT INTO approval_instances (workflow_definition_id, title, biz_type, biz_id, applicant_id, form_data)
VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
		req.WorkflowID, req.Title, req.BizType, req.BizID, middleware.CurrentUserID(c), defaultJSON(req.FormData, "{}")).Scan(&id); err != nil {
		return err
	}
	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}
	_ = h.notifyCurrentApprovalStep(c.Request().Context(), id, middleware.CurrentUserID(c))
	h.hub.BroadcastAll(map[string]string{"event": "approval_submitted"})
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) GetApprovalInstance(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	row := h.db.QueryRow(c.Request().Context(), `
SELECT ai.id, ai.workflow_definition_id, wd.name, ai.title, ai.biz_type, ai.biz_id, ai.applicant_id, u.display_name, ai.status, ai.current_step, ai.form_data, ai.created_at
FROM approval_instances ai
JOIN workflow_definitions wd ON wd.id = ai.workflow_definition_id
JOIN sys_users u ON u.id = ai.applicant_id
WHERE ai.id=$1 AND ai.deleted_at IS NULL`, id)
	var item ApprovalInstanceRow
	if err := row.Scan(&item.ID, &item.WorkflowID, &item.Workflow, &item.Title, &item.BizType, &item.BizID, &item.applicantID, &item.Applicant, &item.Status, &item.CurrentStep, &item.FormData, &item.CreatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "审批实例不存在")
		}
		return err
	}
	actions, err := h.listApprovalActions(c.Request().Context(), id)
	if err != nil {
		return err
	}
	item.Actions = actions
	return response.OK(c, item)
}

type ApprovalActionRequest struct {
	Action  string  `json:"action"`
	Comment *string `json:"comment"`
}

func (h *Handler) ActionApproval(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	var req ApprovalActionRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Action != "APPROVE" && req.Action != "REJECT" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "操作只能是审批通过或驳回")
	}
	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()
	var workflowID int64
	var currentStep int
	var title string
	var currentStatus string
	var applicantID int64
	if err := tx.QueryRow(c.Request().Context(), `SELECT workflow_definition_id, current_step, title, status, applicant_id FROM approval_instances WHERE id=$1 AND deleted_at IS NULL`, id).Scan(&workflowID, &currentStep, &title, &currentStatus, &applicantID); err != nil {
		return err
	}
	if currentStatus != "PENDING" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "该审批已处理，不能重复操作")
	}
	runtimeSteps, workflowDefinition, hasNotificationNode, err := loadApprovalRuntime(c.Request().Context(), tx, workflowID)
	if err != nil {
		return err
	}
	if currentStep < len(runtimeSteps) {
		step := runtimeSteps[currentStep]
		roles, err := h.currentUserRoleLabels(c.Request().Context(), middleware.CurrentUserID(c))
		if err != nil {
			return err
		}
		if !assigneeMatchesRoles(step.Assignee, roles) {
			return response.NewError(http.StatusForbidden, "APPROVAL_ASSIGNEE_MISMATCH", "当前审批节点需要角色: "+step.Assignee+"，您的角色不匹配")
		}
	}
	nextStatus := "REJECTED"
	nextStep := currentStep
	if req.Action == "APPROVE" {
		stepsLen := len(runtimeSteps)
		if stepsLen == 0 || currentStep+1 >= stepsLen {
			nextStatus = "APPROVED"
		} else {
			nextStatus = "PENDING"
			nextStep = currentStep + 1
		}
	}
	if _, err := tx.Exec(c.Request().Context(), `INSERT INTO approval_actions (instance_id, step_index, approver_id, action, comment) VALUES ($1,$2,$3,$4,$5)`, id, currentStep, middleware.CurrentUserID(c), req.Action, req.Comment); err != nil {
		return err
	}
	if _, err := tx.Exec(c.Request().Context(), `UPDATE approval_instances SET status=$2, current_step=$3, updated_at=now() WHERE id=$1`, id, nextStatus, nextStep); err != nil {
		return err
	}
	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}
	if nextStatus == "PENDING" && nextStep < len(runtimeSteps) {
		_ = h.notifyAssigneeUsers(c.Request().Context(), runtimeSteps[nextStep].Assignee, "Approval pending", title, middleware.CurrentUserID(c))
	} else if hasNotificationNode || workflowHasNotificationNode(workflowDefinition) {
		_ = h.notifyUser(c.Request().Context(), applicantID, "Approval updated", title+" -> "+nextStatus, middleware.CurrentUserID(c))
	}
	h.hub.BroadcastAll(map[string]string{"event": "approval_updated"})
	return response.OK(c, map[string]string{"status": nextStatus})
}

type approvalWorkflowRuntime struct {
	ID       int64
	Category string
}

func resolveApprovalWorkflow(ctx context.Context, tx pgx.Tx, workflowID int64) (approvalWorkflowRuntime, error) {
	var item approvalWorkflowRuntime
	err := tx.QueryRow(ctx, `
SELECT id, category
FROM workflow_definitions
WHERE id=$1 AND deleted_at IS NULL AND status='ACTIVE' AND category='approval'`, workflowID).Scan(&item.ID, &item.Category)
	if err == pgx.ErrNoRows {
		return item, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "审批工作流不可用")
	}
	return item, err
}

type collaborationQueryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func loadApprovalRuntime(ctx context.Context, q collaborationQueryer, workflowID int64) ([]approvalRuntimeStep, json.RawMessage, bool, error) {
	var definition json.RawMessage
	if err := q.QueryRow(ctx, `
SELECT definition
FROM workflow_definitions
WHERE id=$1 AND deleted_at IS NULL AND status='ACTIVE'`, workflowID).Scan(&definition); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil, false, nil
		}
		return nil, nil, false, err
	}
	return approvalRuntimeSteps(definition), definition, workflowHasNotificationNode(definition), nil
}

func (h *Handler) listApprovalActions(ctx context.Context, instanceID int64) ([]ApprovalActionRow, error) {
	rows, err := h.db.Query(ctx, `
SELECT aa.id, aa.step_index, u.display_name, aa.action, aa.comment, aa.created_at
FROM approval_actions aa
JOIN sys_users u ON u.id = aa.approver_id
WHERE aa.instance_id = $1
ORDER BY aa.created_at, aa.id`, instanceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]ApprovalActionRow, 0)
	for rows.Next() {
		var item ApprovalActionRow
		if err := rows.Scan(&item.ID, &item.StepIndex, &item.Approver, &item.Action, &item.Comment, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) currentUserRoleLabels(ctx context.Context, userID int64) ([]string, error) {
	rows, err := h.db.Query(ctx, `
SELECT r.code, r.name
FROM sys_roles r
JOIN sys_user_roles ur ON ur.role_id = r.id
WHERE ur.user_id = $1 AND r.deleted_at IS NULL AND r.status = 'ACTIVE'`, userID)
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
		roles = append(roles, code, name)
	}
	return roles, rows.Err()
}

func (h *Handler) notifyCurrentApprovalStep(ctx context.Context, instanceID int64, actorID int64) error {
	var workflowID int64
	var title string
	var currentStep int
	if err := h.db.QueryRow(ctx, `
SELECT workflow_definition_id, title, current_step
FROM approval_instances
WHERE id = $1 AND deleted_at IS NULL`, instanceID).Scan(&workflowID, &title, &currentStep); err != nil {
		return err
	}
	steps, _, _, err := loadApprovalRuntime(ctx, h.db, workflowID)
	if err != nil {
		return err
	}
	if currentStep >= len(steps) {
		return nil
	}
	return h.notifyAssigneeUsers(ctx, steps[currentStep].Assignee, "Approval pending", title, actorID)
}

func (h *Handler) notifyAssigneeUsers(ctx context.Context, assignee string, title string, content string, actorID int64) error {
	userIDs, err := h.userIDsForAssignee(ctx, assignee)
	if err != nil {
		return err
	}
	if len(userIDs) == 0 {
		if strings.TrimSpace(assignee) != "" {
			return nil
		}
		_, err := h.insertNotification(ctx, NotificationRequest{Title: title, Content: content, NotifType: "approval", SourceModule: "approval"}, actorID)
		if err == nil {
			h.broadcastUnread(ctx, nil)
		}
		return err
	}
	for _, userID := range userIDs {
		if err := h.notifyUser(ctx, userID, title, content, actorID); err != nil {
			return err
		}
	}
	return nil
}

func (h *Handler) notifyUser(ctx context.Context, userID int64, title string, content string, actorID int64) error {
	recipientID := userID
	_, err := h.insertNotification(ctx, NotificationRequest{Title: title, Content: content, NotifType: "approval", SourceModule: "approval", RecipientID: &recipientID}, actorID)
	if err == nil {
		h.broadcastUnread(ctx, &recipientID)
	}
	return err
}

func (h *Handler) userIDsForAssignee(ctx context.Context, assignee string) ([]int64, error) {
	labels := normalizeAssigneeLabels(assignee)
	if len(labels) == 0 {
		return nil, nil
	}
	rows, err := h.db.Query(ctx, `
SELECT DISTINCT u.id
FROM sys_users u
JOIN sys_user_roles ur ON ur.user_id = u.id
JOIN sys_roles r ON r.id = ur.role_id
WHERE u.deleted_at IS NULL
  AND u.status = 'ACTIVE'
  AND r.deleted_at IS NULL
  AND r.status = 'ACTIVE'
  AND (lower(r.code) = ANY($1) OR lower(r.name) = ANY($1))
ORDER BY u.id`, labels)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	userIDs := make([]int64, 0)
	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, userID)
	}
	return userIDs, rows.Err()
}

type WorkflowRow struct {
	ID          int64           `json:"id"`
	Name        string          `json:"name"`
	Category    string          `json:"category"`
	Description *string         `json:"description"`
	Definition  json.RawMessage `json:"definition"`
	Status      string          `json:"status"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func (h *Handler) ListWorkflows(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	category := c.QueryParam("category")
	status := c.QueryParam("status")
	rows, err := h.db.Query(c.Request().Context(), `
SELECT id, name, category, description, definition, status, updated_at
FROM workflow_definitions
WHERE deleted_at IS NULL
  AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR COALESCE(description, '') ILIKE '%' || $1 || '%')
  AND ($2 = '' OR category = $2)
  AND ($3 = '' OR status = $3)
ORDER BY updated_at DESC`, keyword, category, status)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]WorkflowRow, 0)
	for rows.Next() {
		var item WorkflowRow
		if err := rows.Scan(&item.ID, &item.Name, &item.Category, &item.Description, &item.Definition, &item.Status, &item.UpdatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) CreateWorkflow(c echo.Context) error {
	var req WorkflowRow
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Name == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "名称不能为空")
	}
	if req.Category == "" {
		req.Category = "general"
	}
	if req.Status == "" {
		req.Status = "DRAFT"
	}
	var id int64
	if err := h.db.QueryRow(c.Request().Context(), `
INSERT INTO workflow_definitions (name, category, description, definition, status, created_by)
VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING id`,
		req.Name, req.Category, req.Description, defaultJSON(req.Definition, "{}"), req.Status, middleware.CurrentUserID(c)).Scan(&id); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateWorkflow(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	var req WorkflowRow
	if err := c.Bind(&req); err != nil {
		return err
	}
	if _, err := h.db.Exec(c.Request().Context(), `
UPDATE workflow_definitions SET name=$2, category=$3, description=$4, definition=$5::jsonb, status=$6, updated_at=now()
WHERE id=$1 AND deleted_at IS NULL`, id, req.Name, req.Category, req.Description, defaultJSON(req.Definition, "{}"), req.Status); err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteWorkflow(c echo.Context) error {
	return softDelete(c, h.db, "workflow_definitions")
}

type WorkflowRunRequest struct {
	Title string          `json:"title"`
	Input json.RawMessage `json:"input"`
}

func (h *Handler) RunWorkflow(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	var req WorkflowRunRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Title == "" {
		req.Title = "Manual workflow run"
	}
	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()
	var definition json.RawMessage
	if err := tx.QueryRow(c.Request().Context(), `
SELECT definition FROM workflow_definitions WHERE id=$1 AND deleted_at IS NULL`, id).Scan(&definition); err != nil {
		if err == pgx.ErrNoRows {
			return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "工作流不存在")
		}
		return err
	}
	nodes := executableWorkflowNodes(definition)
	var instanceID int64
	if err := tx.QueryRow(c.Request().Context(), `
INSERT INTO workflow_instances (definition_id, title, status, input, started_by)
VALUES ($1,$2,'COMPLETED',$3::jsonb,$4) RETURNING id`,
		id, req.Title, defaultJSON(req.Input, "{}"), middleware.CurrentUserID(c)).Scan(&instanceID); err != nil {
		return err
	}
	for _, node := range nodes {
		if _, err := tx.Exec(c.Request().Context(), `
INSERT INTO workflow_logs (instance_id, node_key, node_name, status, message)
VALUES ($1,$2,$3,'COMPLETED',$4)`, instanceID, node.Key, node.Name, workflowNodeRunMessage(node)); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(c.Request().Context(), `UPDATE workflow_instances SET ended_at=now() WHERE id=$1`, instanceID); err != nil {
		return err
	}
	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": instanceID})
}

func (h *Handler) ListWorkflowInstances(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `
SELECT wi.id, wi.definition_id, wd.name, wi.title, wi.status, wi.started_at, wi.ended_at
FROM workflow_instances wi JOIN workflow_definitions wd ON wd.id = wi.definition_id
ORDER BY wi.started_at DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, definitionID int64
		var definitionName, title, status string
		var startedAt time.Time
		var endedAt *time.Time
		if err := rows.Scan(&id, &definitionID, &definitionName, &title, &status, &startedAt, &endedAt); err != nil {
			return err
		}
		items = append(items, map[string]any{"id": id, "definition_id": definitionID, "definition_name": definitionName, "title": title, "status": status, "started_at": startedAt, "ended_at": endedAt})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) GetWorkflowInstance(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	rows, err := h.db.Query(c.Request().Context(), `SELECT node_key, node_name, status, message, created_at FROM workflow_logs WHERE instance_id=$1 ORDER BY id`, id)
	if err != nil {
		return err
	}
	defer rows.Close()
	logs := make([]map[string]any, 0)
	for rows.Next() {
		var nodeKey, nodeName, status string
		var message *string
		var createdAt time.Time
		if err := rows.Scan(&nodeKey, &nodeName, &status, &message, &createdAt); err != nil {
			return err
		}
		logs = append(logs, map[string]any{"node_key": nodeKey, "node_name": nodeName, "status": status, "message": message, "created_at": createdAt})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, map[string]any{"id": id, "logs": logs})
}

type AIMessageRow struct {
	ID        int64     `json:"id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type AIChatRequest struct {
	Message string `json:"message"`
}

func (h *Handler) ListAIMessages(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `
SELECT id, role, content, created_at
FROM ai_assistant_messages
WHERE user_id=$1
ORDER BY created_at DESC
LIMIT 50`, middleware.CurrentUserID(c))
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]AIMessageRow, 0)
	for rows.Next() {
		var item AIMessageRow
		if err := rows.Scan(&item.ID, &item.Role, &item.Content, &item.CreatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) ChatAI(c echo.Context) error {
	var req AIChatRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Message == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "消息内容不能为空")
	}
	endpoint := os.Getenv("AI_ASSISTANT_ENDPOINT")
	if endpoint == "" {
		return response.NewError(http.StatusServiceUnavailable, "AI_NOT_CONFIGURED", "AI 服务未配置，请设置 AI_ASSISTANT_ENDPOINT")
	}
	userID := middleware.CurrentUserID(c)
	if _, err := h.db.Exec(c.Request().Context(), `INSERT INTO ai_assistant_messages (user_id, role, content) VALUES ($1,'user',$2)`, userID, req.Message); err != nil {
		return err
	}
	reply, err := callAIEndpoint(c.Request().Context(), endpoint, os.Getenv("AI_ASSISTANT_API_KEY"), req.Message)
	if err != nil {
		return err
	}
	if _, err := h.db.Exec(c.Request().Context(), `INSERT INTO ai_assistant_messages (user_id, role, content) VALUES ($1,'assistant',$2)`, userID, reply); err != nil {
		return err
	}
	return response.OK(c, map[string]string{"reply": reply})
}

func callAIEndpoint(ctx context.Context, endpoint string, apiKey string, message string) (string, error) {
	body, _ := json.Marshal(map[string]string{"message": message})
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}
	res, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", response.NewError(http.StatusBadGateway, "AI_PROVIDER_ERROR", string(data))
	}
	var parsed struct {
		Reply string `json:"reply"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return "", err
	}
	if parsed.Reply == "" {
		return "", response.NewError(http.StatusBadGateway, "AI_PROVIDER_ERROR", "AI 提供方响应格式错误，缺少 reply 字段")
	}
	return parsed.Reply, nil
}

func (h *Handler) NotificationWS(c echo.Context) error {
	token := c.QueryParam("token")
	claims, err := auth.Parse(h.jwtSecret, token)
	if err != nil {
		return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "登录已过期，请重新登录")
	}
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		host := r.Host
		if strings.Contains(origin, host) {
			return true
		}
		return false
	}}
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	h.hub.Add(claims.UserID, conn)
	defer h.hub.Remove(claims.UserID, conn)
	if count, err := h.unreadCount(c.Request().Context(), claims.UserID); err == nil {
		_ = conn.WriteJSON(map[string]any{"event": "unread_count", "count": count})
	}
	for {
		if _, _, err := conn.NextReader(); err != nil {
			return nil
		}
	}
}

func (h *Handler) insertNotification(ctx context.Context, req NotificationRequest, createdBy int64) (int64, error) {
	var id int64
	err := h.db.QueryRow(ctx, `
INSERT INTO sys_notifications (title, content, notif_type, source_module, recipient_id, created_by)
VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, req.Title, req.Content, req.NotifType, req.SourceModule, req.RecipientID, createdBy).Scan(&id)
	return id, err
}

func (h *Handler) unreadCount(ctx context.Context, userID int64) (int64, error) {
	var count int64
	err := h.db.QueryRow(ctx, `
SELECT count(*) FROM sys_notifications
WHERE deleted_at IS NULL AND read_at IS NULL AND (recipient_id IS NULL OR recipient_id=$1)`, userID).Scan(&count)
	return count, err
}

func (h *Handler) broadcastUnread(ctx context.Context, userID *int64) {
	if userID != nil {
		if count, err := h.unreadCount(ctx, *userID); err == nil {
			h.hub.Broadcast(*userID, map[string]any{"event": "unread_count", "count": count})
		}
		return
	}
	h.hub.BroadcastAll(map[string]string{"event": "notifications_changed"})
}

type notificationHub struct {
	mu      sync.Mutex
	clients map[int64]map[*websocket.Conn]struct{}
}

func newNotificationHub() *notificationHub {
	return &notificationHub{clients: map[int64]map[*websocket.Conn]struct{}{}}
}

func (h *notificationHub) Add(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[userID] == nil {
		h.clients[userID] = map[*websocket.Conn]struct{}{}
	}
	h.clients[userID][conn] = struct{}{}
}

func (h *notificationHub) Remove(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients[userID], conn)
	_ = conn.Close()
}

func (h *notificationHub) Broadcast(userID int64, payload any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for conn := range h.clients[userID] {
		_ = conn.WriteJSON(payload)
	}
}

func (h *notificationHub) BroadcastAll(payload any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, conns := range h.clients {
		for conn := range conns {
			_ = conn.WriteJSON(payload)
		}
	}
}

func parseID(c echo.Context) (int64, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return 0, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "ID 格式错误")
	}
	return id, nil
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

func defaultJSON(raw json.RawMessage, fallback string) string {
	if len(raw) == 0 {
		return fallback
	}
	return string(raw)
}

func safeTableName(name string) bool {
	for _, ch := range name {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_') {
			return false
		}
	}
	return len(name) > 0
}

func softDelete(c echo.Context, db *pgxpool.Pool, table string) error {
	if !safeTableName(table) {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "表名不合法")
	}
	id, err := parseID(c)
	if err != nil {
		return err
	}
	sql := "UPDATE " + table + " SET deleted_at=now(), updated_at=now() WHERE id=$1 AND deleted_at IS NULL"
	if _, err := db.Exec(c.Request().Context(), sql, id); err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"deleted": true})
}
