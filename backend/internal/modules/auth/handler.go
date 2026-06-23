package authmodule

import (
	"net/http"
	"sort"
	"time"

	"enterprise-demo/backend/internal/auth"
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
	g.POST("/auth/login", h.Login)
	g.POST("/auth/refresh", h.Refresh)
	g.GET("/auth/me", h.Me, middleware.Auth(h.jwtSecret))
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         CurrentUser `json:"user"`
}

type CurrentUser struct {
	ID          int64      `json:"id"`
	Username    string     `json:"username"`
	DisplayName string     `json:"display_name"`
	Permissions []string   `json:"permissions"`
	Menus       []MenuNode `json:"menus"`
}

type MenuNode struct {
	ID       int64      `json:"id"`
	ParentID *int64     `json:"parent_id,omitempty"`
	Type     string     `json:"type"`
	Code     string     `json:"code"`
	Name     string     `json:"name"`
	Path     *string    `json:"path,omitempty"`
	Icon     *string    `json:"icon,omitempty"`
	Children []MenuNode `json:"children,omitempty"`
}

func (h *Handler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	var userID int64
	var username, displayName, passwordHash string
	err := h.db.QueryRow(c.Request().Context(), `
SELECT id, username, display_name, password_hash
FROM sys_users
WHERE username = $1 AND deleted_at IS NULL AND status = 'ACTIVE'`, req.Username).
		Scan(&userID, &username, &displayName, &passwordHash)
	if err != nil {
		return response.NewError(http.StatusUnauthorized, "AUTH_LOGIN_FAILED", "用户名或密码错误")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return response.NewError(http.StatusUnauthorized, "AUTH_LOGIN_FAILED", "用户名或密码错误")
	}

	accessToken, err := auth.Sign(h.jwtSecret, userID, username, 8*time.Hour)
	if err != nil {
		return err
	}
	refreshToken, err := auth.Sign(h.jwtSecret, userID, username, 7*24*time.Hour)
	if err != nil {
		return err
	}

	user, err := h.currentUser(c, userID)
	if err != nil {
		return err
	}
	user.DisplayName = displayName

	return response.OK(c, LoginResponse{AccessToken: accessToken, RefreshToken: refreshToken, User: user})
}

func (h *Handler) Refresh(c echo.Context) error {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}
	claims, err := auth.Parse(h.jwtSecret, req.RefreshToken)
	if err != nil {
		return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "invalid refresh token")
	}
	accessToken, err := auth.Sign(h.jwtSecret, claims.UserID, claims.Username, 8*time.Hour)
	if err != nil {
		return err
	}
	return response.OK(c, map[string]string{"access_token": accessToken})
}

func (h *Handler) Me(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	user, err := h.currentUser(c, userID)
	if err != nil {
		return err
	}
	return response.OK(c, user)
}

func (h *Handler) currentUser(c echo.Context, userID int64) (CurrentUser, error) {
	var user CurrentUser
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT id, username, display_name
FROM sys_users
WHERE id = $1 AND deleted_at IS NULL`, userID).Scan(&user.ID, &user.Username, &user.DisplayName); err != nil {
		return user, response.NewError(http.StatusUnauthorized, "AUTH_USER_NOT_FOUND", "user not found")
	}

	rows, err := h.db.Query(c.Request().Context(), `
SELECT DISTINCT m.id, m.parent_id, m.type, m.code, m.name, m.path, m.icon, m.sort_order
FROM sys_menus m
JOIN sys_role_menus rm ON rm.menu_id = m.id
JOIN sys_user_roles ur ON ur.role_id = rm.role_id
WHERE ur.user_id = $1
  AND m.deleted_at IS NULL
  AND m.status = 'ACTIVE'
ORDER BY m.sort_order, m.id`, userID)
	if err != nil {
		return user, err
	}
	defer rows.Close()

	flat := make([]MenuNode, 0)
	for rows.Next() {
		var node MenuNode
		var sortOrder int
		if err := rows.Scan(&node.ID, &node.ParentID, &node.Type, &node.Code, &node.Name, &node.Path, &node.Icon, &sortOrder); err != nil {
			return user, err
		}
		if node.Type == "button" {
			user.Permissions = append(user.Permissions, node.Code)
			continue
		}
		if node.Type == "page" {
			user.Permissions = append(user.Permissions, node.Code)
		}
		flat = append(flat, node)
	}
	user.Menus = buildTree(flat)
	sort.Strings(user.Permissions)
	return user, nil
}

func buildTree(flat []MenuNode) []MenuNode {
	byID := make(map[int64]*MenuNode, len(flat))
	for i := range flat {
		node := flat[i]
		node.Children = nil
		byID[node.ID] = &node
	}
	for _, original := range flat {
		node := byID[original.ID]
		if node.ParentID == nil {
			continue
		}
		parent, ok := byID[*node.ParentID]
		if ok {
			parent.Children = append(parent.Children, *node)
		}
	}
	roots := make([]MenuNode, 0)
	for _, original := range flat {
		node := byID[original.ID]
		if node.ParentID == nil {
			roots = append(roots, *node)
			continue
		}
		if _, ok := byID[*node.ParentID]; !ok {
			roots = append(roots, *node)
		}
	}
	return roots
}
