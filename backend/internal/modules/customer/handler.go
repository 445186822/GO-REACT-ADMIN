package customer

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"enterprise-demo/backend/internal/exportxlsx"
	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"
	"enterprise-demo/backend/internal/importxlsx"
	"enterprise-demo/backend/internal/modules/recyclebin"

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
	group := g.Group("/customers", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
	group.POST("", h.Create)
	group.POST("/export", h.Export)
	group.GET("/import-template", h.ImportTemplate)
	group.POST("/import", h.Import)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
}

type Row struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Level      string  `json:"level"`
	Phone      *string `json:"phone"`
	Email      *string `json:"email"`
	Owner      string  `json:"owner"`
	Department string  `json:"department"`
	Status     string  `json:"status"`
	Remark     *string `json:"remark"`
}

type ExportRequest struct {
	Keyword string `json:"keyword"`
}

func (h *Handler) List(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	keyword := c.QueryParam("keyword")
	page, pageSize := response.PageParams(c, 10000)
	offset := (page - 1) * pageSize
	scope, deptID, err := h.dataScope(c, userID)
	if err != nil {
		return err
	}

	var total int64
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT count(*)
FROM biz_customers bc
WHERE bc.deleted_at IS NULL
  AND ($1 = '' OR bc.name ILIKE '%' || $1 || '%')
  AND ($2 = 'ALL' OR ($2 = 'DEPT' AND bc.department_id = $3) OR ($2 = 'SELF' AND bc.owner_id = $4))`, keyword, scope, deptID, userID).Scan(&total); err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(), `
SELECT bc.id, bc.name, bc.level, bc.phone, bc.email, u.display_name, d.name, bc.status, bc.remark
FROM biz_customers bc
JOIN sys_users u ON u.id = bc.owner_id
JOIN sys_departments d ON d.id = bc.department_id
WHERE bc.deleted_at IS NULL
  AND ($1 = '' OR bc.name ILIKE '%' || $1 || '%')
  AND ($2 = 'ALL' OR ($2 = 'DEPT' AND bc.department_id = $3) OR ($2 = 'SELF' AND bc.owner_id = $4))
ORDER BY bc.created_at DESC
LIMIT $5 OFFSET $6`, keyword, scope, deptID, userID, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.Name, &item.Level, &item.Phone, &item.Email, &item.Owner, &item.Department, &item.Status, &item.Remark); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, response.Page[Row]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) Export(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var req ExportRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	scope, deptID, err := h.dataScope(c, userID)
	if err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(), `
SELECT bc.id, bc.name, bc.level, bc.phone, bc.email, u.display_name, d.name, bc.status, bc.remark
FROM biz_customers bc
JOIN sys_users u ON u.id = bc.owner_id
JOIN sys_departments d ON d.id = bc.department_id
WHERE bc.deleted_at IS NULL
  AND ($1 = '' OR bc.name ILIKE '%' || $1 || '%')
  AND ($2 = 'ALL' OR ($2 = 'DEPT' AND bc.department_id = $3) OR ($2 = 'SELF' AND bc.owner_id = $4))
ORDER BY bc.created_at DESC
LIMIT 10000`, req.Keyword, scope, deptID, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	sheetRows := [][]string{{
		"ID",
		"客户名称",
		"级别",
		"手机",
		"邮箱",
		"负责人",
		"部门",
		"状态",
		"备注",
	}}
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.Name, &item.Level, &item.Phone, &item.Email, &item.Owner, &item.Department, &item.Status, &item.Remark); err != nil {
			return err
		}
		sheetRows = append(sheetRows, []string{
			strconv.FormatInt(item.ID, 10),
			item.Name,
			levelText(item.Level),
			stringValue(item.Phone),
			stringValue(item.Email),
			item.Owner,
			item.Department,
			statusText(item.Status),
			stringValue(item.Remark),
		})
	}

	content, err := exportxlsx.Build("Customers", sheetRows)
	if err != nil {
		return err
	}

	filename := fmt.Sprintf("customers_%s.xlsx", time.Now().Format("20060102_150405"))
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf(`attachment; filename="%s"`, filename))
	return c.Blob(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content)
}

func (h *Handler) ImportTemplate(c echo.Context) error {
	content, err := exportxlsx.Build("Customers", customerImportTemplateRows())
	if err != nil {
		return err
	}
	filename := fmt.Sprintf("customer_import_template_%s.xlsx", time.Now().Format("20060102"))
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf(`attachment; filename="%s"`, filename))
	return c.Blob(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content)
}

func (h *Handler) Import(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "file is required")
	}
	if strings.ToLower(filepath.Ext(fileHeader.Filename)) != ".xlsx" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "only .xlsx files are supported")
	}
	file, err := fileHeader.Open()
	if err != nil {
		return err
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, 10<<20))
	if err != nil {
		return err
	}
	rows, err := importxlsx.Read(content)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid xlsx file")
	}
	customers, failures := parseCustomerImportRows(rows)
	if len(customers) == 0 {
		result := ImportResult{Success: 0, Failed: len(failures), Errors: failures}
		result.Total = result.Success + result.Failed
		return response.OK(c, result)
	}

	var deptID int64
	if err := h.db.QueryRow(c.Request().Context(), `SELECT department_id FROM sys_users WHERE id = $1`, userID).Scan(&deptID); err != nil {
		return err
	}
	imported := 0
	for _, customer := range customers {
		if _, err := h.db.Exec(c.Request().Context(), `
INSERT INTO biz_customers (name, level, phone, email, owner_id, department_id, status, remark)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			customer.Name, customer.Level, customer.Phone, customer.Email, userID, deptID, customer.Status, customer.Remark); err != nil {
			failures = append(failures, ImportFailure{Row: 0, Reason: fmt.Sprintf("客户 %s 保存失败：%s", customer.Name, err.Error())})
			continue
		}
		imported++
	}
	result := ImportResult{Success: imported, Failed: len(failures), Errors: failures}
	result.Total = result.Success + result.Failed
	return response.OK(c, result)
}

func (h *Handler) Create(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var req Row
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Name == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
	}
	var deptID int64
	if err := h.db.QueryRow(c.Request().Context(), `SELECT department_id FROM sys_users WHERE id = $1`, userID).Scan(&deptID); err != nil {
		return err
	}
	if req.Level == "" {
		req.Level = "NORMAL"
	}
	if req.Status == "" {
		req.Status = "ACTIVE"
	}
	var id int64
	if err := h.db.QueryRow(c.Request().Context(), `
INSERT INTO biz_customers (name, level, phone, email, owner_id, department_id, status, remark)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id`, req.Name, req.Level, req.Phone, req.Email, userID, deptID, req.Status, req.Remark).Scan(&id); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req Row
	if err := c.Bind(&req); err != nil {
		return err
	}
	tag, err := h.db.Exec(c.Request().Context(), `
UPDATE biz_customers
SET name = $2, level = $3, phone = $4, email = $5, status = $6, remark = $7, updated_at = now()
WHERE id = $1 AND deleted_at IS NULL`, id, req.Name, req.Level, req.Phone, req.Email, req.Status, req.Remark)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "customer not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	userID := middleware.CurrentUserID(c)

	// Fetch name for recycle bin log
	var name string
	h.db.QueryRow(c.Request().Context(), `SELECT name FROM biz_customers WHERE id = $1 AND deleted_at IS NULL`, id).Scan(&name)

	tag, err := h.db.Exec(c.Request().Context(), `UPDATE biz_customers SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "customer not found")
	}

	if name != "" {
		_ = recyclebin.LogDeletion(c.Request().Context(), h.db, "biz_customers", id, name, userID)
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

func (h *Handler) dataScope(c echo.Context, userID int64) (string, int64, error) {
	var isSuper bool
	var deptID int64
	if err := h.db.QueryRow(c.Request().Context(), `SELECT is_super_admin, COALESCE(department_id, 0) FROM sys_users WHERE id = $1`, userID).Scan(&isSuper, &deptID); err != nil {
		return "SELF", 0, err
	}
	if isSuper {
		return "ALL", deptID, nil
	}
	var scope string
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT COALESCE(max(rm.data_scope), 'SELF')
FROM sys_role_menus rm
JOIN sys_user_roles ur ON ur.role_id = rm.role_id
JOIN sys_menus m ON m.id = rm.menu_id
WHERE ur.user_id = $1 AND m.code = 'customer:view'`, userID).Scan(&scope); err != nil {
		return "SELF", deptID, err
	}
	return scope, deptID, nil
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func levelText(level string) string {
	switch level {
	case "IMPORTANT":
		return "重点客户"
	case "POTENTIAL":
		return "潜在客户"
	default:
		return "普通客户"
	}
}

func statusText(status string) string {
	if status == "ACTIVE" {
		return "有效"
	}
	return "停用"
}
