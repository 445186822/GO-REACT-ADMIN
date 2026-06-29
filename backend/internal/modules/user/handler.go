package user

import (
	"net/http"
	"strconv"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db        *pgxpool.Pool
	jwtSecret string
}

func NewHandler(db *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

func (h *Handler) Register(g *echo.Group) {
	users := g.Group("/users", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	users.GET("", h.List)
	users.POST("", h.Create)
	users.PUT("/:id", h.Update)
	users.DELETE("/:id", h.Delete)
	users.PUT("/:id/reset-password", h.ResetPassword)
}

type Row struct {
	ID          int64   `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	Email       *string `json:"email"`
	Phone       *string `json:"phone"`
	Status      string  `json:"status"`
	Department  *string `json:"department"`
	Roles       *string `json:"roles"`
}

func (h *Handler) List(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize

	var total int64
	if err := h.db.QueryRow(c.Request().Context(), `
	SELECT count(*)
	FROM sys_users u
	WHERE u.deleted_at IS NULL
	  AND ($1 = '' OR u.username ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')`, keyword).Scan(&total); err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(), `
	SELECT u.id, u.username, u.display_name, u.email, u.phone, u.status, d.name,
	       COALESCE(string_agg(r.name, '，'), '')
	FROM sys_users u
	LEFT JOIN sys_departments d ON d.id = u.department_id
	LEFT JOIN sys_user_roles ur ON ur.user_id = u.id
	LEFT JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
	WHERE u.deleted_at IS NULL
	  AND ($1 = '' OR u.username ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')
	GROUP BY u.id, d.name
	ORDER BY u.created_at DESC
	LIMIT $2 OFFSET $3`, keyword, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &item.Email, &item.Phone, &item.Status, &item.Department, &item.Roles); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, response.Page[Row]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) Create(c echo.Context) error {
	var req struct {
		Username    string  `json:"username"`
		Password    string  `json:"password"`
		DisplayName string  `json:"display_name"`
		Email       *string `json:"email"`
		Phone       *string `json:"phone"`
		RoleID      *int64  `json:"role_id"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Username == "" || req.Password == "" || req.DisplayName == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "username, password and display_name are required")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()

	var id int64
	if err := tx.QueryRow(c.Request().Context(), `
	INSERT INTO sys_users (username, password_hash, display_name, email, phone, department_id)
	VALUES ($1, $2, $3, $4, $5, 2)
	RETURNING id`, req.Username, string(hash), req.DisplayName, req.Email, req.Phone).Scan(&id); err != nil {
		return err
	}

	// Assign role if provided
	if req.RoleID != nil {
		if _, err := tx.Exec(c.Request().Context(),
			`INSERT INTO sys_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, *req.RoleID); err != nil {
			return err
		}
	}

	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req struct {
		DisplayName string  `json:"display_name"`
		Email       *string `json:"email"`
		Phone       *string `json:"phone"`
		Status      string  `json:"status"`
		RoleID      *int64  `json:"role_id"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Status == "" {
		req.Status = "ACTIVE"
	}

	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()

	tag, err := tx.Exec(c.Request().Context(), `
	UPDATE sys_users
	SET display_name = $2, email = $3, phone = $4, status = $5, updated_at = now()
	WHERE id = $1 AND deleted_at IS NULL`, id, req.DisplayName, req.Email, req.Phone, req.Status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "user not found")
	}

	// Update role assignment
	if _, err := tx.Exec(c.Request().Context(), `DELETE FROM sys_user_roles WHERE user_id = $1`, id); err != nil {
		return err
	}
	if req.RoleID != nil {
		if _, err := tx.Exec(c.Request().Context(),
			`INSERT INTO sys_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, *req.RoleID); err != nil {
			return err
		}
	}

	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	if id == 1 {
		return response.NewError(http.StatusBadRequest, "BUSINESS_RULE_FAILED", "admin cannot be deleted")
	}
	tag, err := h.db.Exec(c.Request().Context(), `UPDATE sys_users SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "user not found")
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

func (h *Handler) ResetPassword(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}
	if len(req.Password) < 6 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "password must be at least 6 characters")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	tag, err := h.db.Exec(c.Request().Context(),
		`UPDATE sys_users SET password_hash = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, id, string(hash))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "user not found")
	}
	return response.OK(c, map[string]bool{"reset": true})
}

func pagination(c echo.Context) (int64, int64) {
	page, _ := strconv.ParseInt(c.QueryParam("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.QueryParam("page_size"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 10000 {
		pageSize = 20
	}
	return page, pageSize
}
