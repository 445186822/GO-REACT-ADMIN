package collaboration

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/labstack/echo/v4"
)

const deepseekBaseURL = "https://api.deepseek.com/anthropic"
const deepseekModel = "deepseek-v4-flash"

func (h *Handler) registerAIRoutes(g *echo.Group) {
	ai := g.Group("/ai", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	ai.POST("/chat", h.Chat)
	ai.GET("/history", h.ChatHistory)
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Messages []ChatMessage `json:"messages"`
}

type DeepSeekRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

func (h *Handler) Chat(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var req ChatRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if len(req.Messages) == 0 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "messages required")
	}

	authToken := "sk-13184616fc9444cca790b7e780c78706"

	systemMsg := ChatMessage{
		Role:    "system",
		Content: "你是企业基础平台的内置AI助手，运行在DeepSeek模型上。你可以帮助用户解答系统使用问题、提供数据分析建议、协助编写文档等。请用中文回复，保持专业且友好的语气。",
	}

	allMessages := append([]ChatMessage{systemMsg}, req.Messages...)

	apiReq := DeepSeekRequest{
		Model:    deepseekModel,
		Messages: allMessages,
		Stream:   true,
	}

	body, _ := json.Marshal(apiReq)

	httpReq, err := http.NewRequestWithContext(c.Request().Context(), "POST",
		deepseekBaseURL+"/v1/messages", strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", authToken)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		h.saveChatHistory(userID, req.Messages, "", "ERROR: "+err.Error())
		return response.NewError(http.StatusBadGateway, "AI_ERROR", "AI服务连接失败: "+err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		h.saveChatHistory(userID, req.Messages, "", "ERROR: "+string(errBody))
		return response.NewError(http.StatusBadGateway, "AI_ERROR",
			fmt.Sprintf("AI服务返回错误 (%d): %s", resp.StatusCode, string(errBody)))
	}

	c.Response().Header().Set(echo.HeaderContentType, "text/event-stream")
	c.Response().WriteHeader(http.StatusOK)

	var fullResponse strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break
			}

			var event map[string]interface{}
			if err := json.Unmarshal([]byte(data), &event); err != nil {
				continue
			}

			eventType, _ := event["type"].(string)
			switch eventType {
			case "content_block_delta":
				delta, _ := event["delta"].(map[string]interface{})
				text, _ := delta["text"].(string)
				if text != "" {
					fullResponse.WriteString(text)
					chunk := map[string]string{"delta": text}
					chunkBytes, _ := json.Marshal(chunk)
					fmt.Fprintf(c.Response(), "data: %s\n\n", string(chunkBytes))
					c.Response().Flush()
				}
			case "message_stop":
				// Stream completed
			}
		}
	}

	fmt.Fprintf(c.Response(), "data: [DONE]\n\n")
	c.Response().Flush()

	// Save history
	h.saveChatHistory(userID, req.Messages, fullResponse.String(), "")

	return nil
}

func (h *Handler) ChatHistory(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	rows, err := h.db.Query(c.Request().Context(),
		`SELECT role, content, created_at FROM ai_chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type HistoryItem struct {
		Role      string `json:"role"`
		Content   string `json:"content"`
		CreatedAt string `json:"created_at"`
	}
	items := make([]HistoryItem, 0)
	for rows.Next() {
		var item HistoryItem
		if err := rows.Scan(&item.Role, &item.Content, &item.CreatedAt); err != nil {
			return err
		}
		items = append([]HistoryItem{item}, items...)
	}
	return response.OK(c, items)
}

func (h *Handler) saveChatHistory(userID int64, msgs []ChatMessage, response string, errMsg string) {
	content := ""
	if response != "" {
		content = response
	} else if errMsg != "" {
		content = errMsg
	}
	if content == "" && len(msgs) > 0 {
		content = msgs[len(msgs)-1].Content
	}

	role := "assistant"
	if errMsg != "" {
		role = "error"
	}

	h.db.Exec(context.Background(),
		`INSERT INTO ai_chat_history (user_id, role, content) VALUES ($1, $2, $3)`,
		userID, role, truncate(content, 4000))
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
