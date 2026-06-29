package role

import (
	"net/http"
	"strconv"

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
	group := g.Group("/roles", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
	group.GET("/:id/menus", h.ListRoleMenus)
	group.PUT("/:id/menus", h.UpdateRoleMenus)
}

type Row struct {
	ID          int64   `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type CreateRoleRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type UpdateRoleRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

func (h *Handler) List(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `SELECT id, code, name, description, status FROM sys_roles WHERE deleted_at IS NULL ORDER BY id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.Code, &item.Name, &item.Description, &item.Status); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, items)
}

func (h *Handler) Create(c echo.Context) error {
	var req CreateRoleRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Code == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "code is required")
	}
	if req.Name == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
	}
	if req.Status == "" {
		req.Status = "ACTIVE"
	}
	var id int64
	err := h.db.QueryRow(c.Request().Context(), `
		INSERT INTO sys_roles (code, name, description, status)
		VALUES ($1, $2, $3, $4) RETURNING id
	`, req.Code, req.Name, req.Description, req.Status).Scan(&id)
	if err != nil {
		return err
	}
	return response.Created(c, Row{ID: id, Code: req.Code, Name: req.Name, Description: &req.Description, Status: req.Status})
}

func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req UpdateRoleRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Name == nil && req.Description == nil && req.Status == nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "no fields to update")
	}
	setClauses := ""
	args := []any{}
	argIdx := 1
	if req.Name != nil {
		setClauses += "name = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Description != nil {
		setClauses += "description = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Status != nil {
		setClauses += "status = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Status)
		argIdx++
	}
	setClauses += "updated_at = now()"
	args = append(args, id)

	sql := "UPDATE sys_roles SET " + setClauses + " WHERE id = $" + strconv.Itoa(argIdx) + " AND deleted_at IS NULL"
	result, err := h.db.Exec(c.Request().Context(), sql, args...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "role not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	// Prevent deleting the ADMIN role
	var code string
	if err := h.db.QueryRow(c.Request().Context(), `SELECT code FROM sys_roles WHERE id = $1 AND deleted_at IS NULL`, id).Scan(&code); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "role not found")
	}
	if code == "ADMIN" {
		return response.NewError(http.StatusForbidden, "FORBIDDEN", "cannot delete the ADMIN role")
	}
	result, err := h.db.Exec(c.Request().Context(),
		`UPDATE sys_roles SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "role not found")
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

func (h *Handler) ListRoleMenus(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	rows, err := h.db.Query(c.Request().Context(), `SELECT menu_id FROM sys_role_menus WHERE role_id = $1`, id)
	if err != nil {
		return err
	}
	defer rows.Close()
	menuIDs := make([]int64, 0)
	for rows.Next() {
		var menuID int64
		if err := rows.Scan(&menuID); err != nil {
			return err
		}
		menuIDs = append(menuIDs, menuID)
	}
	return response.OK(c, menuIDs)
}

type UpdateRoleMenusRequest struct {
	MenuIDs []int64 `json:"menu_ids"`
}

func (h *Handler) UpdateRoleMenus(c echo.Context) error {
	roleID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req UpdateRoleMenusRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()

	if _, err := tx.Exec(c.Request().Context(), `DELETE FROM sys_role_menus WHERE role_id = $1`, roleID); err != nil {
		return err
	}

	for _, menuID := range req.MenuIDs {
		if _, err := tx.Exec(c.Request().Context(),
			`INSERT INTO sys_role_menus (role_id, menu_id, data_scope) VALUES ($1, $2, 'ALL') ON CONFLICT DO NOTHING`,
			roleID, menuID); err != nil {
			return err
		}
	}

	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}

	return response.OK(c, map[string]bool{"updated": true})
}
