package chat

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"enterprise-demo/backend/internal/auth"
	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	db            *pgxpool.Pool
	jwtSecret     string
	allowedOrigin string
	hub           *chatHub
}

func NewHandler(db *pgxpool.Pool, jwtSecret string, allowedOrigin string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret, allowedOrigin: allowedOrigin, hub: newChatHub()}
}

func (h *Handler) Register(g *echo.Group) {
	authGroup := g.Group("", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))

	authGroup.GET("/chat/sessions", h.ListSessions)
	authGroup.POST("/chat/sessions", h.CreateSession)
	authGroup.GET("/chat/sessions/:id", h.GetSession)
	authGroup.GET("/chat/sessions/:id/messages", h.ListMessages)
	authGroup.POST("/chat/sessions/:id/messages", h.SendMessage)
	authGroup.POST("/chat/sessions/:id/messages/:message_id/revoke", h.RevokeMessage)
	authGroup.PUT("/chat/sessions/:id/read", h.MarkRead)
	authGroup.PUT("/chat/sessions/:id/settings", h.UpdateSessionSettings)
	authGroup.POST("/chat/sessions/:id/participants", h.AddParticipants)
	authGroup.DELETE("/chat/sessions/:id/participants/:user_id", h.RemoveParticipant)
	authGroup.PUT("/chat/sessions/:id", h.UpdateSession)
	authGroup.GET("/chat/users", h.SearchUsers)

	g.GET("/chat/ws", h.ChatWS)
}

type SessionRow struct {
	ID               int64        `json:"id"`
	Title            string       `json:"title"`
	Status           string       `json:"status"`
	CreatedBy        int64        `json:"created_by"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
	Unread           int64        `json:"unread"`
	IsPinned         bool         `json:"is_pinned"`
	Muted            bool         `json:"muted"`
	ParticipantCount int64        `json:"participant_count"`
	LastMsg          *MessageRow  `json:"last_message,omitempty"`
	Users            []UserBrief  `json:"users,omitempty"`
	SharedFiles      []MessageRow `json:"shared_files,omitempty"`
}

type UserBrief struct {
	ID          int64  `json:"id"`
	DisplayName string `json:"display_name"`
	Username    string `json:"username,omitempty"`
}

type MessageRow struct {
	ID            int64      `json:"id"`
	SessionID     int64      `json:"session_id"`
	SenderID      int64      `json:"sender_id"`
	SenderName    string     `json:"sender_name"`
	MessageType   string     `json:"message_type"`
	Content       string     `json:"content"`
	AttachmentURL *string    `json:"attachment_url,omitempty"`
	Status        string     `json:"status,omitempty"`
	RevokedAt     *time.Time `json:"revoked_at,omitempty"`
	RevokedBy     *int64     `json:"revoked_by,omitempty"`
	ReplyToID     *int64     `json:"reply_to_id,omitempty"`
	FileName      string     `json:"file_name,omitempty"`
	FileSize      int64      `json:"file_size,omitempty"`
	MimeType      string     `json:"mime_type,omitempty"`
	ReadCount     int64      `json:"read_count,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

type CreateSessionRequest struct {
	UserIDs []int64 `json:"user_ids"`
	Title   string  `json:"title"`
}

type SendMessageRequest struct {
	Content       string  `json:"content"`
	MessageType   string  `json:"message_type"`
	AttachmentURL *string `json:"attachment_url,omitempty"`
	ReplyToID     *int64  `json:"reply_to_id,omitempty"`
	FileName      string  `json:"file_name,omitempty"`
	FileSize      int64   `json:"file_size,omitempty"`
	MimeType      string  `json:"mime_type,omitempty"`
}

type SessionSettingsRequest struct {
	IsPinned *bool `json:"is_pinned"`
	Muted    *bool `json:"muted"`
}

type ParticipantsRequest struct {
	UserIDs []int64 `json:"user_ids"`
}

func (h *Handler) ListSessions(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	ctx := c.Request().Context()

	rows, err := h.db.Query(ctx, `
		SELECT cs.id, cs.title, cs.status, cs.created_by, cs.created_at, cs.updated_at,
		       cp.is_pinned, cp.muted,
		       (SELECT COUNT(*) FROM chat_participants p WHERE p.session_id = cs.id AND p.removed_at IS NULL)
		FROM chat_sessions cs
		JOIN chat_participants cp ON cp.session_id = cs.id
		WHERE cp.user_id = $1 AND cp.removed_at IS NULL AND cs.deleted_at IS NULL AND cs.status = 'ACTIVE'
		ORDER BY cp.is_pinned DESC, cs.updated_at DESC
	`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	sessions := make([]SessionRow, 0)
	for rows.Next() {
		var s SessionRow
		if err := rows.Scan(&s.ID, &s.Title, &s.Status, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt, &s.IsPinned, &s.Muted, &s.ParticipantCount); err != nil {
			return err
		}
		sessions = append(sessions, s)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(sessions) == 0 {
		return response.OK(c, sessions)
	}

	// Batch load unread counts, participants, and last messages.
	sessionIDs := make([]int64, len(sessions))
	byID := make(map[int64]int, len(sessions))
	for i := range sessions {
		sessionIDs[i] = sessions[i].ID
		byID[sessions[i].ID] = i
	}

	// Unread counts — single batch query.
	unreadRows, err := h.db.Query(ctx, `
		SELECT cp.session_id,
		       COUNT(cm.id) FILTER (WHERE cm.sender_id != $2 AND cm.message_type != 'SYSTEM' AND cm.status != 'REVOKED'
		                            AND cm.id > COALESCE(cp.last_read_message_id, 0))
		FROM chat_participants cp
		LEFT JOIN chat_messages cm ON cm.session_id = cp.session_id
		WHERE cp.user_id = $2 AND cp.removed_at IS NULL AND cp.session_id = ANY($1)
		GROUP BY cp.session_id
	`, sessionIDs, userID)
	if err != nil {
		return err
	}
	defer unreadRows.Close()
	for unreadRows.Next() {
		var sid, unread int64
		if err := unreadRows.Scan(&sid, &unread); err != nil {
			return err
		}
		if idx, ok := byID[sid]; ok {
			sessions[idx].Unread = unread
		}
	}

	// Participants — single batch query.
	userRows, err := h.db.Query(ctx, `
		SELECT cp.session_id, su.id, su.display_name
		FROM chat_participants cp
		JOIN sys_users su ON su.id = cp.user_id
		WHERE cp.session_id = ANY($1) AND cp.removed_at IS NULL
		ORDER BY cp.created_at, su.id
	`, sessionIDs)
	if err != nil {
		return err
	}
	defer userRows.Close()
	for userRows.Next() {
		var sid, uid int64
		var name string
		if err := userRows.Scan(&sid, &uid, &name); err != nil {
			return err
		}
		if idx, ok := byID[sid]; ok {
			sessions[idx].Users = append(sessions[idx].Users, UserBrief{ID: uid, DisplayName: name})
		}
	}

	// Last messages — single batch query with DISTINCT ON.
	msgRows, err := h.db.Query(ctx, `
		SELECT DISTINCT ON (session_id) `+messageSelectColumns+`
		FROM chat_messages
		WHERE session_id = ANY($1)
		ORDER BY session_id, created_at DESC
	`, sessionIDs)
	if err != nil {
		return err
	}
	defer msgRows.Close()
	for msgRows.Next() {
		var msg MessageRow
		if err := scanMessage(msgRows, &msg); err != nil {
			return err
		}
		if idx, ok := byID[msg.SessionID]; ok {
			sessions[idx].LastMsg = &msg
		}
	}

	return response.OK(c, sessions)
}

func (h *Handler) CreateSession(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var req CreateSessionRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	allIDs := buildParticipantIDs(userID, req.UserIDs)
	if len(allIDs) < 2 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "至少需要选择一个用户")
	}

	names := make([]string, 0, len(allIDs)-1)
	for _, uid := range allIDs {
		if uid == userID {
			continue
		}
		var name string
		if err := h.db.QueryRow(c.Request().Context(), `
			SELECT display_name FROM sys_users
			WHERE id = $1 AND deleted_at IS NULL AND status = 'ACTIVE'
		`, uid).Scan(&name); err != nil {
			return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "用户不存在或已停用")
		}
		names = append(names, name)
	}
	if strings.TrimSpace(req.Title) == "" {
		req.Title = buildSessionTitle(names)
	}

	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()

	var sessionID int64
	if err := tx.QueryRow(c.Request().Context(), `
		INSERT INTO chat_sessions (title, created_by) VALUES ($1, $2) RETURNING id
	`, strings.TrimSpace(req.Title), userID).Scan(&sessionID); err != nil {
		return err
	}

	for _, uid := range allIDs {
		if _, err := tx.Exec(c.Request().Context(), `
			INSERT INTO chat_participants (session_id, user_id) VALUES ($1, $2)
		`, sessionID, uid); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(c.Request().Context(), `
		INSERT INTO chat_messages (session_id, sender_id, sender_name, message_type, content)
		VALUES ($1, $2, $3, 'SYSTEM', $4)
	`, sessionID, userID, "", "会话已创建"); err != nil {
		return err
	}

	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}

	h.hub.BroadcastToUsers(allIDs, map[string]any{"type": "session_new", "session_id": sessionID})
	return response.Created(c, map[string]int64{"id": sessionID})
}

func (h *Handler) GetSession(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var s SessionRow
	if err := h.db.QueryRow(c.Request().Context(), `
		SELECT cs.id, cs.title, cs.status, cs.created_by, cs.created_at, cs.updated_at,
		       cp.is_pinned, cp.muted,
		       (SELECT COUNT(*) FROM chat_participants p WHERE p.session_id = cs.id AND p.removed_at IS NULL)
		FROM chat_sessions cs
		JOIN chat_participants cp ON cp.session_id = cs.id AND cp.user_id = $2
		WHERE cs.id = $1 AND cp.removed_at IS NULL AND cs.deleted_at IS NULL
	`, sessionID, userID).Scan(&s.ID, &s.Title, &s.Status, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt, &s.IsPinned, &s.Muted, &s.ParticipantCount); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "会话不存在")
	}
	s.Users, _ = h.loadParticipants(c.Request().Context(), sessionID)
	s.SharedFiles, _ = h.loadSharedFiles(c.Request().Context(), sessionID)
	return response.OK(c, s)
}

func (h *Handler) ListMessages(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	limit := int64(50)
	if value, err := strconv.ParseInt(c.QueryParam("limit"), 10, 64); err == nil && value > 0 && value <= 100 {
		limit = value
	}

	query := `SELECT ` + messageSelectColumns + ` FROM chat_messages WHERE session_id = $1`
	args := []any{sessionID}
	if before := c.QueryParam("before"); before != "" {
		beforeID, err := parseID(before, "invalid before id")
		if err != nil {
			return err
		}
		query += " AND id < $" + strconv.Itoa(len(args)+1)
		args = append(args, beforeID)
	}
	query += " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(len(args)+1)
	args = append(args, limit)

	rows, err := h.db.Query(c.Request().Context(), query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	messages := make([]MessageRow, 0)
	for rows.Next() {
		var msg MessageRow
		if err := scanMessage(rows, &msg); err != nil {
			return err
		}
		messages = append(messages, msg)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	reads, _ := h.participantReadMap(c.Request().Context(), sessionID)
	for i := range messages {
		messages[i].ReadCount = readCountForMessage(messages[i].ID, messages[i].SenderID, reads)
	}
	return response.OK(c, messages)
}

func (h *Handler) SendMessage(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var req SendMessageRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	senderName := h.senderName(c.Request().Context(), userID)
	msg, err := h.insertMessage(c.Request().Context(), sessionID, userID, senderName, req)
	if err != nil {
		return err
	}
	h.hub.Broadcast(sessionID, map[string]any{"type": "message", "message": msg})
	return response.Created(c, msg)
}

func (h *Handler) MarkRead(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var lastMessageID int64
	_ = h.db.QueryRow(c.Request().Context(), `
		SELECT COALESCE(MAX(id), 0) FROM chat_messages WHERE session_id = $1
	`, sessionID).Scan(&lastMessageID)

	if _, err := h.db.Exec(c.Request().Context(), `
		UPDATE chat_participants
		SET last_read_at = now(), last_read_message_id = NULLIF($3::bigint, 0)
		WHERE session_id = $1 AND user_id = $2
	`, sessionID, userID, lastMessageID); err != nil {
		return err
	}
	h.hub.Broadcast(sessionID, map[string]any{
		"type":       "read_receipt",
		"session_id": sessionID,
		"user_id":    userID,
		"message_id": lastMessageID,
	})
	return response.OK(c, map[string]bool{"read": true})
}

func (h *Handler) UpdateSession(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var body struct {
		Title  *string `json:"title"`
		Status *string `json:"status"`
	}
	if err := c.Bind(&body); err != nil {
		return err
	}

	if body.Status != nil && *body.Status == "CLOSED" {
		if _, err := h.db.Exec(c.Request().Context(), `
			UPDATE chat_participants SET removed_at = now()
			WHERE session_id = $1 AND user_id = $2
		`, sessionID, userID); err != nil {
			return err
		}
		h.hub.BroadcastToUsers([]int64{userID}, map[string]any{"type": "session_updated", "session_id": sessionID})
		return response.OK(c, map[string]bool{"updated": true})
	}

	if body.Title != nil {
		title := strings.TrimSpace(*body.Title)
		if title == "" {
			return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "会话标题不能为空")
		}
		if _, err := h.db.Exec(c.Request().Context(), `
			UPDATE chat_sessions SET title = $1, updated_at = now()
			WHERE id = $2 AND deleted_at IS NULL
		`, title, sessionID); err != nil {
			return err
		}
		h.hub.Broadcast(sessionID, map[string]any{"type": "session_updated", "session_id": sessionID})
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) UpdateSessionSettings(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var req SessionSettingsRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if _, err := h.db.Exec(c.Request().Context(), `
		UPDATE chat_participants
		SET is_pinned = COALESCE($3::boolean, is_pinned), muted = COALESCE($4::boolean, muted)
		WHERE session_id = $1 AND user_id = $2
	`, sessionID, userID, req.IsPinned, req.Muted); err != nil {
		return err
	}
	h.hub.BroadcastToUsers([]int64{userID}, map[string]any{"type": "session_updated", "session_id": sessionID})
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) AddParticipants(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var req ParticipantsRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	ids := buildParticipantIDs(userID, req.UserIDs)
	added := make([]int64, 0)
	tx, err := h.db.Begin(c.Request().Context())
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(c.Request().Context()) }()

	for _, uid := range ids {
		if uid == userID {
			continue
		}
		var active bool
		if err := tx.QueryRow(c.Request().Context(), `
			SELECT EXISTS(SELECT 1 FROM sys_users WHERE id = $1 AND deleted_at IS NULL AND status = 'ACTIVE')
		`, uid).Scan(&active); err != nil {
			return err
		}
		if !active {
			return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "用户不存在或已停用")
		}
		// Check whether user is already an active participant
		var alreadyIn bool
		if err := tx.QueryRow(c.Request().Context(), `
			SELECT EXISTS(SELECT 1 FROM chat_participants WHERE session_id = $1 AND user_id = $2 AND removed_at IS NULL)
		`, sessionID, uid).Scan(&alreadyIn); err != nil {
			return err
		}
		if _, err := tx.Exec(c.Request().Context(), `
			INSERT INTO chat_participants (session_id, user_id)
			VALUES ($1, $2)
			ON CONFLICT (session_id, user_id) DO UPDATE SET removed_at = NULL
		`, sessionID, uid); err != nil {
			return err
		}
		if !alreadyIn {
			added = append(added, uid)
		}
	}
	if len(added) == 0 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "请选择要添加的成员")
	}
	if _, err := tx.Exec(c.Request().Context(), `
		INSERT INTO chat_messages (session_id, sender_id, sender_name, message_type, content)
		VALUES ($1, $2, $3, 'SYSTEM', $4)
	`, sessionID, userID, "", "会话成员已更新"); err != nil {
		return err
	}
	if err := tx.Commit(c.Request().Context()); err != nil {
		return err
	}
	h.hub.Broadcast(sessionID, map[string]any{"type": "participants_updated", "session_id": sessionID})
	h.hub.BroadcastToUsers(added, map[string]any{"type": "session_new", "session_id": sessionID})
	return response.Created(c, map[string][]int64{"added": added})
}

func (h *Handler) RemoveParticipant(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	targetID, err := parseID(c.Param("user_id"), "invalid user id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var createdBy, activeCount int64
	if err := h.db.QueryRow(c.Request().Context(), `
		SELECT created_by, (SELECT COUNT(*) FROM chat_participants WHERE session_id = $1 AND removed_at IS NULL)
		FROM chat_sessions WHERE id = $1 AND deleted_at IS NULL
	`, sessionID).Scan(&createdBy, &activeCount); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "会话不存在")
	}
	if targetID != userID && createdBy != userID {
		return response.NewError(http.StatusForbidden, "FORBIDDEN", "只有会话创建人可以移除其他成员")
	}
	if activeCount <= 1 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "不能移除最后一个成员")
	}

	if _, err := h.db.Exec(c.Request().Context(), `
		UPDATE chat_participants SET removed_at = now()
		WHERE session_id = $1 AND user_id = $2 AND removed_at IS NULL
	`, sessionID, targetID); err != nil {
		return err
	}
	h.hub.Broadcast(sessionID, map[string]any{"type": "participants_updated", "session_id": sessionID})
	h.hub.BroadcastToUsers([]int64{targetID}, map[string]any{"type": "session_updated", "session_id": sessionID})
	return response.OK(c, map[string]bool{"removed": true})
}

func (h *Handler) RevokeMessage(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	sessionID, err := parseID(c.Param("id"), "invalid session id")
	if err != nil {
		return err
	}
	messageID, err := parseID(c.Param("message_id"), "invalid message id")
	if err != nil {
		return err
	}
	if err := h.requireParticipant(c.Request().Context(), sessionID, userID); err != nil {
		return err
	}

	var msg MessageRow
	if err := scanMessage(h.db.QueryRow(c.Request().Context(), `
		SELECT `+messageSelectColumns+`
		FROM chat_messages
		WHERE id = $1 AND session_id = $2
	`, messageID, sessionID), &msg); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "消息不存在")
	}
	if !canRevokeMessage(userID, msg, time.Now()) {
		return response.NewError(http.StatusForbidden, "FORBIDDEN", "消息不能撤回")
	}
	if _, err := h.db.Exec(c.Request().Context(), `
		UPDATE chat_messages SET status = 'REVOKED', revoked_at = now(), revoked_by = $3
		WHERE id = $1 AND session_id = $2
	`, messageID, sessionID, userID); err != nil {
		return err
	}
	h.hub.Broadcast(sessionID, map[string]any{
		"type":       "message_revoked",
		"session_id": sessionID,
		"message_id": messageID,
		"user_id":    userID,
	})
	return response.OK(c, map[string]bool{"revoked": true})
}

func (h *Handler) SearchUsers(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	keyword := strings.TrimSpace(c.QueryParam("keyword"))
	limit := int64(chatUserSearchLimit)
	if value, err := strconv.ParseInt(c.QueryParam("limit"), 10, 64); err == nil && value > 0 && value <= chatUserSearchLimit {
		limit = value
	}

	rows, err := h.db.Query(c.Request().Context(), `
		SELECT id, display_name, username
		FROM sys_users
		WHERE deleted_at IS NULL AND status = 'ACTIVE' AND id != $1
		  AND ($2 = '' OR display_name ILIKE '%' || $2 || '%' OR username ILIKE '%' || $2 || '%')
		ORDER BY display_name, id
		LIMIT $3
	`, userID, keyword, limit)
	if err != nil {
		return err
	}
	defer rows.Close()

	users := make([]UserBrief, 0)
	for rows.Next() {
		var user UserBrief
		if err := rows.Scan(&user.ID, &user.DisplayName, &user.Username); err != nil {
			return err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, users)
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type wsMessage struct {
	Type          string  `json:"type"`
	SessionID     int64   `json:"session_id,omitempty"`
	MessageID     int64   `json:"message_id,omitempty"`
	Content       string  `json:"content,omitempty"`
	MessageType   string  `json:"message_type,omitempty"`
	AttachmentURL *string `json:"attachment_url,omitempty"`
	ReplyToID     *int64  `json:"reply_to_id,omitempty"`
	FileName      string  `json:"file_name,omitempty"`
	FileSize      int64   `json:"file_size,omitempty"`
	MimeType      string  `json:"mime_type,omitempty"`
}

type chatClient struct {
	conn     *websocket.Conn
	userID   int64
	sessions map[int64]bool
	mu       sync.Mutex
}

type chatHub struct {
	mu      sync.Mutex
	rooms   map[int64]map[*chatClient]bool
	clients map[*chatClient]bool
}

func newChatHub() *chatHub {
	return &chatHub{
		rooms:   make(map[int64]map[*chatClient]bool),
		clients: make(map[*chatClient]bool),
	}
}

func (hub *chatHub) AddClient(client *chatClient) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	hub.clients[client] = true
}

func (hub *chatHub) RemoveClient(client *chatClient) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	delete(hub.clients, client)
	for sessionID := range client.sessions {
		if room, ok := hub.rooms[sessionID]; ok {
			delete(room, client)
			if len(room) == 0 {
				delete(hub.rooms, sessionID)
			}
		}
	}
}

func (hub *chatHub) JoinRoom(client *chatClient, sessionID int64) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if hub.rooms[sessionID] == nil {
		hub.rooms[sessionID] = make(map[*chatClient]bool)
	}
	hub.rooms[sessionID][client] = true
	client.sessions[sessionID] = true
}

func (hub *chatHub) LeaveRoom(client *chatClient, sessionID int64) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if room, ok := hub.rooms[sessionID]; ok {
		delete(room, client)
		if len(room) == 0 {
			delete(hub.rooms, sessionID)
		}
	}
	delete(client.sessions, sessionID)
}

func (hub *chatHub) Broadcast(sessionID int64, payload any) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if room, ok := hub.rooms[sessionID]; ok {
		data, _ := json.Marshal(payload)
		for client := range room {
			client.mu.Lock()
			err := client.conn.WriteMessage(websocket.TextMessage, data)
			client.mu.Unlock()
			if err != nil {
				slog.Warn("chat ws write error", "user_id", client.userID, "error", err)
			}
		}
	}
}

func (hub *chatHub) BroadcastToUsers(userIDs []int64, payload any) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	data, _ := json.Marshal(payload)
	targets := make(map[int64]bool, len(userIDs))
	for _, uid := range userIDs {
		targets[uid] = true
	}
	for client := range hub.clients {
		if targets[client.userID] {
			client.mu.Lock()
			err := client.conn.WriteMessage(websocket.TextMessage, data)
			client.mu.Unlock()
			if err != nil {
				slog.Warn("chat ws broadcast error", "user_id", client.userID, "error", err)
			}
		}
	}
}

func (h *Handler) ChatWS(c echo.Context) error {
	token := c.QueryParam("token")
	claims, err := auth.Parse(h.jwtSecret, token)
	if err != nil {
		return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "invalid token")
	}

	wsUpgrader := upgrader
	wsUpgrader.CheckOrigin = func(r *http.Request) bool {
		return middleware.OriginAllowed(r.Header.Get("Origin"), r.Host, h.allowedOrigin)
	}
	conn, err := wsUpgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	client := &chatClient{conn: conn, userID: claims.UserID, sessions: make(map[int64]bool)}
	senderName := h.senderName(c.Request().Context(), claims.UserID)
	h.hub.AddClient(client)

	sessionRows, err := h.db.Query(c.Request().Context(), `
		SELECT session_id FROM chat_participants WHERE user_id = $1 AND removed_at IS NULL
	`, claims.UserID)
	if err == nil {
		for sessionRows.Next() {
			var sessionID int64
			if err := sessionRows.Scan(&sessionID); err == nil {
				h.hub.JoinRoom(client, sessionID)
			}
		}
		sessionRows.Close()
	}

	defer func() {
		h.hub.RemoveClient(client)
		_ = conn.Close()
	}()

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var msg wsMessage
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "join":
			if msg.SessionID > 0 && h.requireParticipant(c.Request().Context(), msg.SessionID, claims.UserID) == nil {
				h.hub.JoinRoom(client, msg.SessionID)
			}
		case "leave":
			if msg.SessionID > 0 {
				h.hub.LeaveRoom(client, msg.SessionID)
			}
		case "msg":
			if msg.SessionID == 0 || h.requireParticipant(c.Request().Context(), msg.SessionID, claims.UserID) != nil {
				continue
			}
			row, err := h.insertMessage(c.Request().Context(), msg.SessionID, claims.UserID, senderName, SendMessageRequest{
				Content:       msg.Content,
				MessageType:   msg.MessageType,
				AttachmentURL: msg.AttachmentURL,
				ReplyToID:     msg.ReplyToID,
				FileName:      msg.FileName,
				FileSize:      msg.FileSize,
				MimeType:      msg.MimeType,
			})
			if err != nil {
				slog.Warn("chat ws save msg error", "error", err)
				continue
			}
			h.hub.Broadcast(msg.SessionID, map[string]any{"type": "message", "message": row})
		case "typing":
			if msg.SessionID > 0 && h.requireParticipant(c.Request().Context(), msg.SessionID, claims.UserID) == nil {
				h.hub.Broadcast(msg.SessionID, map[string]any{
					"type":       "typing",
					"user_id":    claims.UserID,
					"name":       senderName,
					"session_id": msg.SessionID,
				})
			}
		case "read":
			if msg.SessionID > 0 && h.requireParticipant(c.Request().Context(), msg.SessionID, claims.UserID) == nil {
				_, _ = h.db.Exec(c.Request().Context(), `
					UPDATE chat_participants
					SET last_read_at = now(), last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), $3)
					WHERE session_id = $1 AND user_id = $2
				`, msg.SessionID, claims.UserID, msg.MessageID)
				h.hub.Broadcast(msg.SessionID, map[string]any{
					"type":       "read_receipt",
					"session_id": msg.SessionID,
					"user_id":    claims.UserID,
					"message_id": msg.MessageID,
				})
			}
		}
	}
	return nil
}

func parseID(value string, message string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", message)
	}
	return id, nil
}

func (h *Handler) senderName(ctx context.Context, userID int64) string {
	var name string
	_ = h.db.QueryRow(ctx, `SELECT display_name FROM sys_users WHERE id = $1`, userID).Scan(&name)
	return name
}
