package authmodule

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"time"

	"enterprise-demo/backend/internal/auth"
	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5"
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
	g.GET("/auth/captcha", h.CaptchaChallenge)
	g.POST("/auth/captcha/verify", h.VerifyCaptcha)
	g.POST("/auth/login", h.Login)
	g.POST("/auth/refresh", h.Refresh)
	g.GET("/auth/me", h.Me, middleware.Auth(h.jwtSecret))
	g.PUT("/auth/password", h.ChangePassword, middleware.Auth(h.jwtSecret))
}

type LoginRequest struct {
	Username     string `json:"username"`
	Password     string `json:"password"`
	CaptchaToken string `json:"captcha_token"`
}

type LoginResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         CurrentUser `json:"user"`
}

type CurrentUser struct {
	ID          int64       `json:"id"`
	Username    string      `json:"username"`
	DisplayName string      `json:"display_name"`
	Roles       []RoleBrief `json:"roles"`
	ActiveRole  *RoleBrief  `json:"active_role,omitempty"`
	Permissions []string    `json:"permissions"`
	Menus       []MenuNode  `json:"menus"`
}

type RoleBrief struct {
	ID   int64  `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
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

const captchaTTL = 2 * time.Minute

func (h *Handler) CaptchaChallenge(c echo.Context) error {
	challenge, err := newSliderChallenge()
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	_, _ = h.db.Exec(ctx, `DELETE FROM auth_captcha_challenges WHERE expires_at < now() - interval '1 hour'`)
	if _, err := h.db.Exec(ctx, `
INSERT INTO auth_captcha_challenges (id, expected_path, challenge_type, expected_x, target_y, image_seed, expires_at)
VALUES ($1, $2, 'slider', $3, $4, $5, now() + ($6 * interval '1 second'))`,
		challenge.ChallengeID,
		[]string{},
		challenge.TargetX,
		challenge.TargetY,
		challenge.ImageSeed,
		int(captchaTTL.Seconds()),
	); err != nil {
		return err
	}

	challenge.ExpiresIn = int(captchaTTL.Seconds())
	return response.OK(c, challenge.CaptchaChallengeResponse)
}

func (h *Handler) VerifyCaptcha(c echo.Context) error {
	var req CaptchaVerifyRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.ChallengeID == "" || len(req.Track) == 0 {
		return response.NewError(http.StatusBadRequest, "AUTH_CAPTCHA_INVALID", "\u9a8c\u8bc1\u8bf7\u6c42\u4e0d\u5b8c\u6574")
	}

	ctx := c.Request().Context()
	var expectedX int
	var expiresAt time.Time
	err := h.db.QueryRow(ctx, `
SELECT expected_x, expires_at
FROM auth_captcha_challenges
WHERE id = $1 AND challenge_type = 'slider' AND verified_at IS NULL AND used_at IS NULL`, req.ChallengeID).Scan(&expectedX, &expiresAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return response.NewError(http.StatusBadRequest, "AUTH_CAPTCHA_INVALID", "\u9a8c\u8bc1\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u83b7\u53d6")
		}
		return err
	}
	if time.Now().After(expiresAt) {
		return response.NewError(http.StatusBadRequest, "AUTH_CAPTCHA_EXPIRED", "\u9a8c\u8bc1\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u8bd5")
	}
	if !verifySliderOffset(expectedX, req.X, sliderCaptchaTolerance) {
		return response.NewError(http.StatusBadRequest, "AUTH_CAPTCHA_FAILED", "\u6ed1\u5757\u4f4d\u7f6e\u4e0d\u6b63\u786e")
	}

	token, err := randomHex(24)
	if err != nil {
		return err
	}
	tag, err := h.db.Exec(ctx, `
UPDATE auth_captcha_challenges
SET verified_token = $2, verified_at = now()
WHERE id = $1 AND verified_at IS NULL AND used_at IS NULL AND expires_at > now()`, req.ChallengeID, token)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return response.NewError(http.StatusBadRequest, "AUTH_CAPTCHA_EXPIRED", "\u9a8c\u8bc1\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u8bd5")
	}

	return response.OK(c, map[string]string{"captcha_token": token})
}

func (h *Handler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if err := h.consumeCaptchaToken(c.Request().Context(), req.CaptchaToken); err != nil {
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

func (h *Handler) consumeCaptchaToken(ctx context.Context, token string) error {
	if token == "" {
		return response.NewError(http.StatusBadRequest, "AUTH_CAPTCHA_REQUIRED", "\u8bf7\u5148\u5b8c\u6210\u62d6\u52a8\u9a8c\u8bc1")
	}

	tag, err := h.db.Exec(ctx, `
UPDATE auth_captcha_challenges
SET used_at = now()
WHERE verified_token = $1
  AND verified_at IS NOT NULL
  AND used_at IS NULL
  AND expires_at > now()`, token)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return response.NewError(http.StatusBadRequest, "AUTH_CAPTCHA_INVALID", "\u62d6\u52a8\u9a8c\u8bc1\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u8bd5")
	}
	return nil
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

func (h *Handler) ChangePassword(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var req ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	if req.OldPassword == "" || len(req.NewPassword) < 6 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "old_password is required and new_password must be at least 6 characters")
	}

	var passwordHash string
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT password_hash
FROM sys_users
WHERE id = $1 AND deleted_at IS NULL AND status = 'ACTIVE'`, userID).Scan(&passwordHash); err != nil {
		if err == pgx.ErrNoRows {
			return response.NewError(http.StatusUnauthorized, "AUTH_USER_NOT_FOUND", "user not found")
		}
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.OldPassword)); err != nil {
		return response.NewError(http.StatusBadRequest, "AUTH_PASSWORD_INVALID", "current password is incorrect")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err := h.db.Exec(c.Request().Context(), `
UPDATE sys_users
SET password_hash = $2, updated_at = now()
WHERE id = $1 AND deleted_at IS NULL`, userID, string(hash)); err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"changed": true})
}

func (h *Handler) currentUser(c echo.Context, userID int64) (CurrentUser, error) {
	var user CurrentUser
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT id, username, display_name
FROM sys_users
WHERE id = $1 AND deleted_at IS NULL`, userID).Scan(&user.ID, &user.Username, &user.DisplayName); err != nil {
		return user, response.NewError(http.StatusUnauthorized, "AUTH_USER_NOT_FOUND", "user not found")
	}

	roleRows, err := h.db.Query(c.Request().Context(), `
SELECT r.id, r.code, r.name
FROM sys_roles r
JOIN sys_user_roles ur ON ur.role_id = r.id
WHERE ur.user_id = $1
  AND r.deleted_at IS NULL
  AND r.status = 'ACTIVE'
ORDER BY r.id`, userID)
	if err != nil {
		return user, err
	}
	for roleRows.Next() {
		var role RoleBrief
		if err := roleRows.Scan(&role.ID, &role.Code, &role.Name); err != nil {
			roleRows.Close()
			return user, err
		}
		user.Roles = append(user.Roles, role)
	}
	if err := roleRows.Err(); err != nil {
		roleRows.Close()
		return user, err
	}
	roleRows.Close()

	activeRole := selectActiveRole(user.Roles, middleware.ActiveRoleCode(c))
	if activeRole == nil {
		return user, nil
	}
	user.ActiveRole = activeRole

	rows, err := h.db.Query(c.Request().Context(), `
SELECT DISTINCT m.id, m.parent_id, m.type, m.code, m.name, m.path, m.icon, m.sort_order
FROM sys_menus m
JOIN sys_role_menus rm ON rm.menu_id = m.id
WHERE rm.role_id = $1
  AND m.deleted_at IS NULL
  AND m.status = 'ACTIVE'
ORDER BY m.sort_order, m.id`, activeRole.ID)
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

func selectActiveRole(roles []RoleBrief, requested string) *RoleBrief {
	if len(roles) == 0 {
		return nil
	}
	if requested != "" {
		for i := range roles {
			if strings.EqualFold(roles[i].Code, requested) || strings.EqualFold(roles[i].Name, requested) {
				return &roles[i]
			}
		}
	}
	return &roles[0]
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
