package response

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"
)

type Body struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Data      any    `json:"data"`
	RequestID string `json:"request_id,omitempty"`
}

type Page[T any] struct {
	Items    []T   `json:"items"`
	Page     int64 `json:"page"`
	PageSize int64 `json:"page_size"`
	Total    int64 `json:"total"`
}

type AppError struct {
	HTTPStatus int
	Code       string
	Message    string
}

func (e *AppError) Error() string {
	return e.Message
}

func NewError(status int, code string, message string) *AppError {
	return &AppError{HTTPStatus: status, Code: code, Message: message}
}

func OK(c echo.Context, data any) error {
	return c.JSON(http.StatusOK, Body{
		Code:    "OK",
		Message: "success",
		Data:    data,
	})
}

func Created(c echo.Context, data any) error {
	return c.JSON(http.StatusCreated, Body{
		Code:    "OK",
		Message: "created",
		Data:    data,
	})
}

func ErrorHandler(log *slog.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}

		requestID, _ := c.Get("request_id").(string)

		var appErr *AppError
		if errors.As(err, &appErr) {
			_ = c.JSON(appErr.HTTPStatus, Body{
				Code:      appErr.Code,
				Message:   appErr.Message,
				Data:      nil,
				RequestID: requestID,
			})
			return
		}

		var echoErr *echo.HTTPError
		if errors.As(err, &echoErr) {
			message, _ := echoErr.Message.(string)
			if message == "" {
				message = http.StatusText(echoErr.Code)
			}
			_ = c.JSON(echoErr.Code, Body{
				Code:      "HTTP_ERROR",
				Message:   message,
				Data:      nil,
				RequestID: requestID,
			})
			return
		}

		log.Error("unhandled error", "request_id", requestID, "error", err)
		_ = c.JSON(http.StatusInternalServerError, Body{
			Code:      "INTERNAL_ERROR",
			Message:   "internal server error",
			Data:      nil,
			RequestID: requestID,
		})
	}
}
