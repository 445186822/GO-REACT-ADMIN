package collaboration

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type aiToolRow interface {
	Scan(dest ...any) error
}

type aiToolRows interface {
	Close()
	Next() bool
	Scan(dest ...any) error
	Err() error
}

type aiToolQueryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) aiToolRow
	Query(ctx context.Context, sql string, args ...any) (aiToolRows, error)
}

type aiToolDB struct {
	db *pgxpool.Pool
}

func (q aiToolDB) QueryRow(ctx context.Context, sql string, args ...any) aiToolRow {
	return q.db.QueryRow(ctx, sql, args...)
}

func (q aiToolDB) Query(ctx context.Context, sql string, args ...any) (aiToolRows, error) {
	return q.db.Query(ctx, sql, args...)
}

type aiDataTool struct {
	name       string
	permission string
	sql        string
	answer     func(int64) string
}

func tryAnswerAIDataQuestion(ctx context.Context, q aiToolQueryer, userID int64, activeRole string, message string) (string, bool, error) {
	if request, ok := matchAICustomerDetailRequest(message); ok {
		return answerAICustomerDetailQuestion(ctx, q, userID, activeRole, request)
	}

	tool, ok := matchAIDataTool(message)
	if !ok {
		return "", false, nil
	}

	allowed, err := userHasAIPermission(ctx, q, userID, activeRole, tool.permission)
	if err != nil {
		return "", true, err
	}
	if !allowed {
		return fmt.Sprintf("当前账号没有 %s 权限，不能查询这项后台数据。请联系管理员为当前角色授权后再试。", tool.permission), true, nil
	}

	var count int64
	if err := q.QueryRow(ctx, tool.sql).Scan(&count); err != nil {
		return "", true, err
	}
	return tool.answer(count), true, nil
}

type aiCustomerDetailRequest struct {
	id      int64
	byID    bool
	keyword string
}

type aiCustomerDetail struct {
	id         int64
	name       string
	level      string
	phone      *string
	email      *string
	owner      string
	department string
	status     string
	remark     *string
	createdAt  time.Time
	updatedAt  time.Time
}

func answerAICustomerDetailQuestion(ctx context.Context, q aiToolQueryer, userID int64, activeRole string, request aiCustomerDetailRequest) (string, bool, error) {
	allowed, err := userHasAIPermission(ctx, q, userID, activeRole, "customer:view")
	if err != nil {
		return "", true, err
	}
	if !allowed {
		return "当前账号没有 customer:view 权限，不能查询客户资料。请联系管理员为当前角色授权后再试。", true, nil
	}
	if !request.byID && request.keyword == "" {
		return "请提供客户ID或客户名称，例如：查询客户ID 12 的资料，或：查询客户星河科技的详情。", true, nil
	}

	scope, deptID, err := aiCustomerDataScope(ctx, q, userID)
	if err != nil {
		return "", true, err
	}
	customers, err := queryAICustomerDetails(ctx, q, userID, scope, deptID, request)
	if err != nil {
		return "", true, err
	}
	if len(customers) == 0 {
		return "没有查询到符合当前权限和数据范围的客户资料。请确认客户ID或名称是否正确。", true, nil
	}
	if len(customers) > 1 {
		return formatAICustomerCandidates(customers), true, nil
	}
	return formatAICustomerDetail(customers[0]), true, nil
}

func aiCustomerDataScope(ctx context.Context, q aiToolQueryer, userID int64) (string, int64, error) {
	var isSuper bool
	var deptID int64
	if err := q.QueryRow(ctx, `SELECT is_super_admin, COALESCE(department_id, 0) FROM sys_users WHERE id = $1`, userID).Scan(&isSuper, &deptID); err != nil {
		return "SELF", 0, err
	}
	if isSuper {
		return "ALL", deptID, nil
	}
	var scope string
	if err := q.QueryRow(ctx, `
SELECT COALESCE(max(rm.data_scope), 'SELF')
FROM sys_role_menus rm
JOIN sys_user_roles ur ON ur.role_id = rm.role_id
JOIN sys_menus m ON m.id = rm.menu_id
WHERE ur.user_id = $1 AND m.code = 'customer:view'`, userID).Scan(&scope); err != nil {
		return "SELF", deptID, err
	}
	return scope, deptID, nil
}

func queryAICustomerDetails(ctx context.Context, q aiToolQueryer, userID int64, scope string, deptID int64, request aiCustomerDetailRequest) ([]aiCustomerDetail, error) {
	const selectSQL = `
SELECT bc.id, bc.name, bc.level, bc.phone, bc.email, u.display_name, d.name, bc.status, bc.remark, bc.created_at, bc.updated_at
FROM biz_customers bc
JOIN sys_users u ON u.id = bc.owner_id
JOIN sys_departments d ON d.id = bc.department_id
WHERE bc.deleted_at IS NULL
  AND ($2 = 'ALL' OR ($2 = 'DEPT' AND bc.department_id = $3) OR ($2 = 'SELF' AND bc.owner_id = $4))`

	var (
		rows aiToolRows
		err  error
	)
	if request.byID {
		rows, err = q.Query(ctx, selectSQL+`
  AND bc.id = $1
ORDER BY bc.created_at DESC
LIMIT 2`, request.id, scope, deptID, userID)
	} else {
		rows, err = q.Query(ctx, selectSQL+`
  AND bc.name ILIKE '%' || $1 || '%'
ORDER BY CASE WHEN bc.name = $1 THEN 0 ELSE 1 END, bc.created_at DESC
LIMIT 6`, request.keyword, scope, deptID, userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customers := make([]aiCustomerDetail, 0)
	for rows.Next() {
		var item aiCustomerDetail
		if err := rows.Scan(&item.id, &item.name, &item.level, &item.phone, &item.email, &item.owner, &item.department, &item.status, &item.remark, &item.createdAt, &item.updatedAt); err != nil {
			return nil, err
		}
		customers = append(customers, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return customers, nil
}

func matchAICustomerDetailRequest(message string) (aiCustomerDetailRequest, bool) {
	text := normalizeAIQuestion(message)
	if !mentionsAny(text, "客户", "customer") || !mentionsAny(text, "资料", "详情", "信息", "档案", "调出", "查询", "查看") {
		return aiCustomerDetailRequest{}, false
	}
	if asksCount(text) {
		return aiCustomerDetailRequest{}, false
	}

	if match := aiCustomerIDPattern.FindStringSubmatch(text); len(match) == 2 {
		id, err := strconv.ParseInt(match[1], 10, 64)
		if err == nil && id > 0 {
			return aiCustomerDetailRequest{id: id, byID: true}, true
		}
	}

	keyword := extractAICustomerKeyword(message)
	return aiCustomerDetailRequest{keyword: keyword}, true
}

func extractAICustomerKeyword(message string) string {
	text := strings.TrimSpace(message)
	for _, pattern := range aiCustomerNamePatterns {
		if match := pattern.FindStringSubmatch(text); len(match) == 2 {
			return cleanAICustomerKeyword(match[1])
		}
	}
	return ""
}

func cleanAICustomerKeyword(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Trim(value, " ：:，,。.?？")
	for _, suffix := range []string{"的所有资料", "所有资料", "的资料", "资料", "的详情", "详情", "的信息", "信息", "的档案", "档案"} {
		value = strings.TrimSuffix(value, suffix)
	}
	return strings.TrimSpace(strings.Trim(value, " ：:，,。.?？"))
}

func formatAICustomerDetail(customer aiCustomerDetail) string {
	lines := []string{
		"查询到客户资料：",
		fmt.Sprintf("客户ID：%d", customer.id),
		"客户名称：" + customer.name,
		"客户级别：" + aiCustomerLevelText(customer.level),
		"手机：" + aiStringValue(customer.phone),
		"邮箱：" + aiStringValue(customer.email),
		"负责人：" + customer.owner,
		"部门：" + customer.department,
		"状态：" + aiCustomerStatusText(customer.status),
		"备注：" + aiStringValue(customer.remark),
		"创建时间：" + aiTimeValue(customer.createdAt),
		"更新时间：" + aiTimeValue(customer.updatedAt),
	}
	return strings.Join(lines, "\n")
}

func formatAICustomerCandidates(customers []aiCustomerDetail) string {
	lines := []string{"匹配到多个客户，请继续指定客户ID后再查询："}
	for _, customer := range customers {
		lines = append(lines, fmt.Sprintf("ID %d：%s（%s，负责人：%s）", customer.id, customer.name, aiCustomerLevelText(customer.level), customer.owner))
	}
	lines = append(lines, "请继续指定客户ID，例如：查询客户ID 12 的资料。")
	return strings.Join(lines, "\n")
}

func aiStringValue(value *string) string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return "未填写"
	}
	return *value
}

func aiTimeValue(value time.Time) string {
	if value.IsZero() {
		return "未记录"
	}
	return value.Format("2006-01-02 15:04:05")
}

func aiCustomerLevelText(level string) string {
	switch level {
	case "IMPORTANT":
		return "重点客户"
	case "POTENTIAL":
		return "潜在客户"
	default:
		return "普通客户"
	}
}

func aiCustomerStatusText(status string) string {
	if status == "ACTIVE" {
		return "有效"
	}
	return "停用"
}

func matchAIDataTool(message string) (aiDataTool, bool) {
	text := normalizeAIQuestion(message)
	for _, tool := range aiDataTools {
		switch tool.name {
		case "customer_count":
			if mentionsAny(text, "客户", "customer", "customers") && asksCount(text) {
				return tool, true
			}
		case "user_count":
			if mentionsAny(text, "用户", "账号", "user", "users") && asksCount(text) {
				return tool, true
			}
		case "pending_approval_count":
			if mentionsAny(text, "待审批", "待办审批", "pending approval", "pending approvals") && asksCount(text) {
				return tool, true
			}
		case "running_task_count":
			if mentionsAny(text, "运行任务", "启用任务", "定时任务", "scheduled task", "scheduled tasks") && asksCount(text) {
				return tool, true
			}
		}
	}
	return aiDataTool{}, false
}

func userHasAIPermission(ctx context.Context, q aiToolQueryer, userID int64, activeRole string, permission string) (bool, error) {
	var allowed bool
	err := q.QueryRow(ctx, `
SELECT EXISTS (
  SELECT 1
  FROM sys_user_roles ur
  JOIN sys_roles r ON r.id = ur.role_id
  JOIN sys_role_menus rm ON rm.role_id = ur.role_id
  JOIN sys_menus m ON m.id = rm.menu_id
  WHERE ur.user_id = $1
    AND m.code = $2
    AND ($3 = '' OR lower(r.code) = lower($3) OR lower(r.name) = lower($3))
    AND r.deleted_at IS NULL
    AND r.status = 'ACTIVE'
    AND m.deleted_at IS NULL
)`, userID, permission, activeRole).Scan(&allowed)
	return allowed, err
}

func normalizeAIQuestion(message string) string {
	text := strings.ToLower(strings.TrimSpace(message))
	text = strings.ReplaceAll(text, "？", "?")
	text = strings.ReplaceAll(text, "，", ",")
	return text
}

func asksCount(text string) bool {
	return mentionsAny(text, "多少", "几个", "数量", "总数", "统计", "count", "how many")
}

func mentionsAny(text string, words ...string) bool {
	for _, word := range words {
		if strings.Contains(text, strings.ToLower(word)) {
			return true
		}
	}
	return false
}

var aiCustomerIDPattern = regexp.MustCompile(`(?:客户\s*id|客户编号|id|编号)\s*[:：]?\s*(\d+)`)

var aiCustomerNamePatterns = []*regexp.Regexp{
	regexp.MustCompile(`客户\s*([^，。？?]+?)\s*的?\s*(?:所有资料|资料|详情|信息|档案)`),
	regexp.MustCompile(`(?:调出|查询|查看)\s*客户\s*([^，。？?]+)`),
}

var aiDataTools = []aiDataTool{
	{
		name:       "customer_count",
		permission: "customer:view",
		sql:        `SELECT count(*) FROM biz_customers WHERE deleted_at IS NULL`,
		answer: func(count int64) string {
			return fmt.Sprintf("当前后台系统客户数为 %d 个。统计口径：biz_customers 表中 deleted_at IS NULL 的客户。", count)
		},
	},
	{
		name:       "user_count",
		permission: "user:view",
		sql:        `SELECT count(*) FROM sys_users WHERE deleted_at IS NULL`,
		answer: func(count int64) string {
			return fmt.Sprintf("当前后台系统用户数为 %d 个。统计口径：sys_users 表中 deleted_at IS NULL 的用户。", count)
		},
	},
	{
		name:       "pending_approval_count",
		permission: "approval:view",
		sql:        `SELECT count(*) FROM approval_instances WHERE status = 'PENDING' AND deleted_at IS NULL`,
		answer: func(count int64) string {
			return fmt.Sprintf("当前后台系统待审批数量为 %d 个。统计口径：approval_instances 中状态为 PENDING 且未删除的审批实例。", count)
		},
	},
	{
		name:       "running_task_count",
		permission: "scheduler:view",
		sql:        `SELECT count(*) FROM sys_scheduled_tasks WHERE enabled = true`,
		answer: func(count int64) string {
			return fmt.Sprintf("当前后台系统启用中的定时任务为 %d 个。统计口径：sys_scheduled_tasks 中 enabled = true 的任务。", count)
		},
	},
}
