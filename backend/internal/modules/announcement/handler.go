package announcement

import (
	"context"
	"errors"
	"net/http"
	"strconv"
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
	db            *pgxpool.Pool
	jwtSecret     string
	allowedOrigin string
	hub           *announcementHub
}

func NewHandler(db *pgxpool.Pool, jwtSecret string, allowedOrigin string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret, allowedOrigin: allowedOrigin, hub: newAnnouncementHub()}
}

func (h *Handler) Register(g *echo.Group) {
	authGroup := g.Group("", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	authGroup.POST("/announcements", h.CreateAnnouncement)
	authGroup.GET("/announcements", h.ListAnnouncements)
	authGroup.GET("/announcements/unread-count", h.UnreadCount)
	authGroup.PUT("/announcements/:id", h.UpdateAnnouncement)
	authGroup.PUT("/announcements/:id/expire", h.ExpireAnnouncement)
	authGroup.GET("/announcements/:id/read-status", h.ReadStatus)
	authGroup.PUT("/announcements/:id/read", h.MarkRead)
	authGroup.GET("/announcements/:id", h.GetAnnouncement)
	g.GET("/announcements/ws", h.AnnouncementWS)
}

// --- Models ---

type AnnouncementRow struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	Category    string     `json:"category"`
	Priority    string     `json:"priority"`
	Status      string     `json:"status"`
	CreatedBy   int64      `json:"created_by"`
	PublishedAt time.Time  `json:"published_at"`
	ExpiredAt   *time.Time `json:"expired_at,omitempty"`
	ArchivedAt  *time.Time `json:"archived_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	// Computed fields
	ReadCount  *int64     `json:"read_count,omitempty"`
	TotalCount *int64     `json:"total_count,omitempty"`
	MyReadAt   *time.Time `json:"my_read_at,omitempty"` // current user's read time
}

type RecipientReadRow struct {
	UserID      int64      `json:"user_id"`
	DisplayName string     `json:"display_name"`
	Avatar      *string    `json:"avatar,omitempty"`
	ReadAt      *time.Time `json:"read_at"` // NULL = unread
}

type ReadStatusResponse struct {
	Total     int64              `json:"total"`
	ReadCount int64              `json:"read_count"`
	Readers   []RecipientReadRow `json:"readers"`
	Unreaders []RecipientReadRow `json:"unreaders"`
}

type AnnouncementRequest struct {
	Title        string  `json:"title"`
	Content      string  `json:"content"`
	Category     string  `json:"category"`
	Priority     string  `json:"priority"`
	RecipientIDs []int64 `json:"recipient_ids"`        // nil = all users
	ExpiredAt    *string `json:"expired_at,omitempty"` // ISO8601
}

type AnnouncementUpdateRequest struct {
	Title    *string `json:"title,omitempty"`
	Content  *string `json:"content,omitempty"`
	Category *string `json:"category,omitempty"`
	Priority *string `json:"priority,omitempty"`
	Status   *string `json:"status,omitempty"`
}

// --- Helpers ---

func parseID(c echo.Context) (int64, error) {
	return strconv.ParseInt(c.Param("id"), 10, 64)
}

func pagination(c echo.Context) (page, pageSize int) {
	page, _ = strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ = strconv.Atoi(c.QueryParam("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}
	return
}

// --- CRUD Handlers ---

func (h *Handler) CreateAnnouncement(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var req AnnouncementRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Title == "" || req.Content == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "title and content are required")
	}
	if req.Category == "" {
		req.Category = "notice"
	}
	if req.Priority == "" {
		req.Priority = "normal"
	}

	ctx := c.Request().Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Parse expired_at
	var expiredAt *time.Time
	if req.ExpiredAt != nil && *req.ExpiredAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ExpiredAt)
		if err != nil {
			return response.NewError(http.StatusBadRequest, "INVALID_DATE", "expired_at must be RFC3339")
		}
		expiredAt = &t
	}

	// Insert announcement
	var annID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO announcements (title, content, category, priority, status, created_by, published_at, expired_at)
		VALUES ($1, $2, $3, $4, 'published', $5, now(), $6)
		RETURNING id
	`, req.Title, req.Content, req.Category, req.Priority, userID, expiredAt).Scan(&annID)
	if err != nil {
		return err
	}

	// Insert recipients
	if len(req.RecipientIDs) > 0 {
		batch := &pgx.Batch{}
		for _, rid := range req.RecipientIDs {
			batch.Queue(`INSERT INTO announcement_recipients (announcement_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, annID, rid)
		}
		br := tx.SendBatch(ctx, batch)
		if err := br.Close(); err != nil {
			return err
		}
	} else {
		// Broadcast to ALL users
		_, err = tx.Exec(ctx, `
			INSERT INTO announcement_recipients (announcement_id, user_id)
			SELECT $1, id FROM sys_users WHERE status = 'ACTIVE' AND deleted_at IS NULL
		`, annID)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	h.broadcastChanged()
	return response.Created(c, map[string]int64{"id": annID})
}

func (h *Handler) UpdateAnnouncement(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	id, err := parseID(c)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "INVALID_ID", "无效的公告ID")
	}

	var req AnnouncementUpdateRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	ctx := c.Request().Context()
	// Verify ownership
	var createdBy int64
	err = h.db.QueryRow(ctx, `SELECT created_by FROM announcements WHERE id = $1 AND deleted_at IS NULL`, id).Scan(&createdBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return response.NewError(http.StatusNotFound, "NOT_FOUND", "announcement not found")
	}
	if err != nil {
		return err
	}
	if createdBy != userID {
		return response.NewError(http.StatusForbidden, "FORBIDDEN", "only the creator can edit this announcement")
	}

	// Dynamic update
	setClauses := ""
	args := []any{}
	argIdx := 1
	if req.Title != nil {
		setClauses += "title = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Content != nil {
		setClauses += "content = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Content)
		argIdx++
	}
	if req.Category != nil {
		setClauses += "category = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Category)
		argIdx++
	}
	if req.Priority != nil {
		setClauses += "priority = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Priority)
		argIdx++
	}
	if req.Status != nil {
		setClauses += "status = $" + strconv.Itoa(argIdx) + ", "
		args = append(args, *req.Status)
		argIdx++
	}
	if setClauses == "" {
		return response.NewError(http.StatusBadRequest, "NO_CHANGE", "没有需要更新的字段")
	}
	setClauses += "updated_at = now()"
	args = append(args, id)

	_, err = h.db.Exec(ctx, `UPDATE announcements SET `+setClauses+` WHERE id = $`+strconv.Itoa(argIdx)+` AND deleted_at IS NULL`, args...)
	if err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) ExpireAnnouncement(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	id, err := parseID(c)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "INVALID_ID", "无效的公告ID")
	}

	_, err = h.db.Exec(c.Request().Context(), `
		UPDATE announcements SET status = 'expired', expired_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL AND created_by = $2
	`, id, userID)
	if err != nil {
		return err
	}
	h.broadcastChanged()
	return response.OK(c, map[string]bool{"expired": true})
}

func (h *Handler) ListAnnouncements(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize
	scope := c.QueryParam("scope")       // "all" | "mine" | "expired"
	status := c.QueryParam("status")     // filter by status
	category := c.QueryParam("category") // filter by category

	// Build WHERE
	where := "a.deleted_at IS NULL"
	args := []any{}
	argIdx := 1

	// Default: hide expired unless explicitly asking
	if scope != "expired" && status == "" {
		where += " AND a.status != 'expired'"
	} else if scope == "expired" {
		where += " AND a.status = 'expired'"
	}
	if status != "" {
		where += " AND a.status = $" + strconv.Itoa(argIdx)
		args = append(args, status)
		argIdx++
	}
	if category != "" {
		where += " AND a.category = $" + strconv.Itoa(argIdx)
		args = append(args, category)
		argIdx++
	}
	if scope == "mine" {
		where += " AND a.created_by = $" + strconv.Itoa(argIdx)
		args = append(args, userID)
		argIdx++
	}

	// Count
	var total int64
	countSQL := `SELECT count(*) FROM announcements a WHERE ` + where
	if err := h.db.QueryRow(c.Request().Context(), countSQL, args...).Scan(&total); err != nil {
		return err
	}

	// Query with read stats
	args = append(args, userID, pageSize, offset)
	rows, err := h.db.Query(c.Request().Context(), `
		SELECT a.id, a.title, a.content, a.category, a.priority, a.status,
		       a.created_by, a.published_at, a.expired_at, a.archived_at, a.created_at, a.updated_at,
		       (SELECT count(*) FROM announcement_recipients ar WHERE ar.announcement_id = a.id) AS total_count,
		       (SELECT count(*) FROM announcement_recipients ar WHERE ar.announcement_id = a.id AND ar.read_at IS NOT NULL) AS read_count,
		       (SELECT ar2.read_at FROM announcement_recipients ar2 WHERE ar2.announcement_id = a.id AND ar2.user_id = $`+strconv.Itoa(argIdx)+`) AS my_read_at
		FROM announcements a
		WHERE `+where+`
		ORDER BY a.created_at DESC
		LIMIT $`+strconv.Itoa(argIdx+1)+` OFFSET $`+strconv.Itoa(argIdx+2)+`
	`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]AnnouncementRow, 0)
	for rows.Next() {
		var item AnnouncementRow
		if err := rows.Scan(
			&item.ID, &item.Title, &item.Content, &item.Category, &item.Priority, &item.Status,
			&item.CreatedBy, &item.PublishedAt, &item.ExpiredAt, &item.ArchivedAt, &item.CreatedAt, &item.UpdatedAt,
			&item.TotalCount, &item.ReadCount, &item.MyReadAt,
		); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	return response.OK(c, response.Page[AnnouncementRow]{Items: items, Page: int64(page), PageSize: int64(pageSize), Total: total})
}

func (h *Handler) GetAnnouncement(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "INVALID_ID", "无效的公告ID")
	}

	var item AnnouncementRow
	err = h.db.QueryRow(c.Request().Context(), `
		SELECT a.id, a.title, a.content, a.category, a.priority, a.status,
		       a.created_by, a.published_at, a.expired_at, a.archived_at, a.created_at, a.updated_at,
		       (SELECT count(*) FROM announcement_recipients ar WHERE ar.announcement_id = a.id) AS total_count,
		       (SELECT count(*) FROM announcement_recipients ar WHERE ar.announcement_id = a.id AND ar.read_at IS NOT NULL) AS read_count
		FROM announcements a
		WHERE a.id = $1 AND a.deleted_at IS NULL
	`, id).Scan(
		&item.ID, &item.Title, &item.Content, &item.Category, &item.Priority, &item.Status,
		&item.CreatedBy, &item.PublishedAt, &item.ExpiredAt, &item.ArchivedAt, &item.CreatedAt, &item.UpdatedAt,
		&item.TotalCount, &item.ReadCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return response.NewError(http.StatusNotFound, "NOT_FOUND", "announcement not found")
	}
	if err != nil {
		return err
	}
	return response.OK(c, item)
}

func (h *Handler) ReadStatus(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "INVALID_ID", "无效的公告ID")
	}

	ctx := c.Request().Context()

	var exists bool
	err = h.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM announcements a
			WHERE a.id = $1 AND a.deleted_at IS NULL
		)
	`, id).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return response.NewError(http.StatusNotFound, "NOT_FOUND", "announcement not found")
	}

	// Get total count
	var total int64
	h.db.QueryRow(ctx, `SELECT count(*) FROM announcement_recipients WHERE announcement_id = $1`, id).Scan(&total)

	// Get readers
	readerRows, err := h.db.Query(ctx, `
		SELECT ar.user_id, u.display_name, NULL::text AS avatar, ar.read_at
		FROM announcement_recipients ar
		JOIN sys_users u ON u.id = ar.user_id
		WHERE ar.announcement_id = $1 AND ar.read_at IS NOT NULL
		ORDER BY ar.read_at ASC
	`, id)
	if err != nil {
		return err
	}
	readers := make([]RecipientReadRow, 0)
	for readerRows.Next() {
		var r RecipientReadRow
		if err := readerRows.Scan(&r.UserID, &r.DisplayName, &r.Avatar, &r.ReadAt); err != nil {
			readerRows.Close()
			return err
		}
		readers = append(readers, r)
	}
	readerRows.Close()
	if err := readerRows.Err(); err != nil {
		return err
	}

	// Get unreaders
	unreaderRows, err := h.db.Query(ctx, `
		SELECT ar.user_id, u.display_name, NULL::text AS avatar
		FROM announcement_recipients ar
		JOIN sys_users u ON u.id = ar.user_id
		WHERE ar.announcement_id = $1 AND ar.read_at IS NULL
		ORDER BY u.display_name ASC
	`, id)
	if err != nil {
		return err
	}
	unreaders := make([]RecipientReadRow, 0)
	for unreaderRows.Next() {
		var r RecipientReadRow
		if err := unreaderRows.Scan(&r.UserID, &r.DisplayName, &r.Avatar); err != nil {
			unreaderRows.Close()
			return err
		}
		unreaders = append(unreaders, r)
	}
	unreaderRows.Close()
	if err := unreaderRows.Err(); err != nil {
		return err
	}

	return response.OK(c, ReadStatusResponse{
		Total:     total,
		ReadCount: int64(len(readers)),
		Readers:   readers,
		Unreaders: unreaders,
	})
}

func (h *Handler) MarkRead(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	id, err := parseID(c)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "INVALID_ID", "无效的公告ID")
	}

	tag, err := h.db.Exec(c.Request().Context(), `
		UPDATE announcement_recipients
		SET read_at = COALESCE(read_at, now())
		WHERE announcement_id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusForbidden, "FORBIDDEN", "announcement is not assigned to current user")
	}

	h.broadcastUnread(c.Request().Context(), userID)
	return response.OK(c, map[string]bool{"read": true})
}

func (h *Handler) UnreadCount(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var count int64
	err := h.db.QueryRow(c.Request().Context(), `
		SELECT count(*) FROM announcement_recipients ar
		JOIN announcements a ON a.id = ar.announcement_id AND a.deleted_at IS NULL AND a.status != 'expired'
		WHERE ar.user_id = $1 AND ar.read_at IS NULL
	`, userID).Scan(&count)
	if err != nil {
		return err
	}
	return response.OK(c, map[string]int64{"count": count})
}

func (h *Handler) AnnouncementWS(c echo.Context) error {
	token := c.QueryParam("token")
	claims, err := auth.Parse(h.jwtSecret, token)
	if err != nil {
		return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "invalid token")
	}
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool {
		return middleware.OriginAllowed(r.Header.Get("Origin"), r.Host, h.allowedOrigin)
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

func (h *Handler) unreadCount(ctx context.Context, userID int64) (int64, error) {
	var count int64
	err := h.db.QueryRow(ctx, `
		SELECT count(*) FROM announcement_recipients ar
		JOIN announcements a ON a.id = ar.announcement_id AND a.deleted_at IS NULL AND a.status != 'expired'
		WHERE ar.user_id = $1 AND ar.read_at IS NULL
	`, userID).Scan(&count)
	return count, err
}

func (h *Handler) broadcastUnread(ctx context.Context, userID int64) {
	if count, err := h.unreadCount(ctx, userID); err == nil {
		h.hub.Broadcast(userID, map[string]any{"event": "unread_count", "count": count})
	}
}

func (h *Handler) broadcastChanged() {
	h.hub.BroadcastAll(map[string]string{"event": "notifications_changed"})
}

type announcementHub struct {
	mu      sync.Mutex
	clients map[int64]map[*websocket.Conn]struct{}
}

func newAnnouncementHub() *announcementHub {
	return &announcementHub{clients: map[int64]map[*websocket.Conn]struct{}{}}
}

func (h *announcementHub) Add(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[userID] == nil {
		h.clients[userID] = map[*websocket.Conn]struct{}{}
	}
	h.clients[userID][conn] = struct{}{}
}

func (h *announcementHub) Remove(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients[userID], conn)
	_ = conn.Close()
}

func (h *announcementHub) Broadcast(userID int64, payload any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for conn := range h.clients[userID] {
		_ = conn.WriteJSON(payload)
	}
}

func (h *announcementHub) BroadcastAll(payload any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, clients := range h.clients {
		for conn := range clients {
			_ = conn.WriteJSON(payload)
		}
	}
}
