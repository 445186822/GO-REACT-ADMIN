package middleware

import (
	"log/slog"
	"time"

	"github.com/labstack/echo/v4"
)

func RequestLogger(log *slog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			latency := time.Since(start)

			requestID, _ := c.Get(RequestIDKey).(string)
			req := c.Request()
			res := c.Response()

			log.Info("http request",
				"request_id", requestID,
				"method", req.Method,
				"path", req.URL.Path,
				"status", res.Status,
				"latency_ms", latency.Milliseconds(),
				"ip", c.RealIP(),
			)

			return err
		}
	}
}
