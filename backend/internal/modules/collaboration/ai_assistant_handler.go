package collaboration

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/labstack/echo/v4"
)

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
	userID := middleware.CurrentUserID(c)
	if _, err := h.db.Exec(c.Request().Context(), `INSERT INTO ai_assistant_messages (user_id, role, content) VALUES ($1,'user',$2)`, userID, req.Message); err != nil {
		return err
	}

	reply, handled, err := tryAnswerAIDataQuestion(c.Request().Context(), aiToolDB{db: h.db}, userID, middleware.ActiveRoleCode(c), req.Message)
	if err != nil {
		return err
	}
	if handled {
		if _, err := h.db.Exec(c.Request().Context(), `INSERT INTO ai_assistant_messages (user_id, role, content) VALUES ($1,'assistant',$2)`, userID, reply); err != nil {
			return err
		}
		return response.OK(c, map[string]string{"reply": reply})
	}

	endpoint := h.ai.AssistantEndpoint
	if endpoint == "" {
		return response.NewError(http.StatusServiceUnavailable, "AI_NOT_CONFIGURED", "AI 服务未配置，请设置 AI_ASSISTANT_ENDPOINT")
	}
	reply, err = callAIEndpoint(c.Request().Context(), endpoint, h.ai.AssistantAPIKey, req.Message)
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
