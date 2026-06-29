package chat

import (
	"context"
	"net/http"
	"strings"

	"enterprise-demo/backend/internal/http/response"
)

const messageSelectColumns = `
	id, session_id, sender_id, sender_name, message_type, content, attachment_url,
	status, revoked_at, revoked_by, reply_to_id, file_name, file_size, mime_type, created_at
`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanMessage(scanner rowScanner, msg *MessageRow) error {
	return scanner.Scan(
		&msg.ID,
		&msg.SessionID,
		&msg.SenderID,
		&msg.SenderName,
		&msg.MessageType,
		&msg.Content,
		&msg.AttachmentURL,
		&msg.Status,
		&msg.RevokedAt,
		&msg.RevokedBy,
		&msg.ReplyToID,
		&msg.FileName,
		&msg.FileSize,
		&msg.MimeType,
		&msg.CreatedAt,
	)
}

func normalizeMessageRequest(req *SendMessageRequest) error {
	req.Content = strings.TrimSpace(req.Content)
	if req.MessageType == "" {
		req.MessageType = "TEXT"
	}
	switch req.MessageType {
	case "TEXT":
		if req.Content == "" {
			return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "消息内容不能为空")
		}
	case "IMAGE", "FILE":
		if req.AttachmentURL == nil || strings.TrimSpace(*req.AttachmentURL) == "" {
			return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "附件消息需要 attachment_url")
		}
		if req.Content == "" {
			req.Content = req.FileName
		}
	default:
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "不支持的消息类型")
	}
	return nil
}

func (h *Handler) requireParticipant(ctx context.Context, sessionID int64, userID int64) error {
	var exists bool
	if err := h.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM chat_participants
			WHERE session_id = $1 AND user_id = $2 AND removed_at IS NULL
		)
	`, sessionID, userID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return response.NewError(http.StatusForbidden, "FORBIDDEN", "你不是该会话的参与者")
	}
	return nil
}

func (h *Handler) participantIDs(ctx context.Context, sessionID int64) ([]int64, error) {
	rows, err := h.db.Query(ctx, `
		SELECT user_id
		FROM chat_participants
		WHERE session_id = $1 AND removed_at IS NULL
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (h *Handler) loadParticipants(ctx context.Context, sessionID int64) ([]UserBrief, error) {
	rows, err := h.db.Query(ctx, `
		SELECT su.id, su.display_name, su.username
		FROM chat_participants cp
		JOIN sys_users su ON su.id = cp.user_id
		WHERE cp.session_id = $1 AND cp.removed_at IS NULL
		ORDER BY cp.created_at, su.id
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]UserBrief, 0)
	for rows.Next() {
		var user UserBrief
		if err := rows.Scan(&user.ID, &user.DisplayName, &user.Username); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (h *Handler) loadSharedFiles(ctx context.Context, sessionID int64) ([]MessageRow, error) {
	rows, err := h.db.Query(ctx, `
		SELECT `+messageSelectColumns+`
		FROM chat_messages
		WHERE session_id = $1 AND message_type IN ('IMAGE', 'FILE') AND status <> 'REVOKED'
		ORDER BY created_at DESC
		LIMIT 50
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := make([]MessageRow, 0)
	for rows.Next() {
		var msg MessageRow
		if err := scanMessage(rows, &msg); err != nil {
			return nil, err
		}
		files = append(files, msg)
	}
	return files, rows.Err()
}

func (h *Handler) participantReadMap(ctx context.Context, sessionID int64) (map[int64]int64, error) {
	rows, err := h.db.Query(ctx, `
		SELECT user_id, COALESCE(last_read_message_id, 0)
		FROM chat_participants
		WHERE session_id = $1 AND removed_at IS NULL
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reads := make(map[int64]int64)
	for rows.Next() {
		var userID, messageID int64
		if err := rows.Scan(&userID, &messageID); err != nil {
			return nil, err
		}
		reads[userID] = messageID
	}
	return reads, rows.Err()
}

func (h *Handler) insertMessage(ctx context.Context, sessionID int64, userID int64, senderName string, req SendMessageRequest) (MessageRow, error) {
	if err := normalizeMessageRequest(&req); err != nil {
		return MessageRow{}, err
	}

	var msg MessageRow
	err := scanMessage(h.db.QueryRow(ctx, `
		INSERT INTO chat_messages (
			session_id, sender_id, sender_name, message_type, content, attachment_url,
			reply_to_id, file_name, file_size, mime_type
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+messageSelectColumns+`
	`, sessionID, userID, senderName, req.MessageType, req.Content, req.AttachmentURL,
		req.ReplyToID, req.FileName, req.FileSize, req.MimeType), &msg)
	if err != nil {
		return MessageRow{}, err
	}

	_, _ = h.db.Exec(ctx, `UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, sessionID)
	return msg, nil
}
