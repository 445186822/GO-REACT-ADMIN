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

			level := slog.LevelInfo
			if res.Status >= 500 {
				level = slog.LevelError
			} else if res.Status >= 400 {
				level = slog.LevelWarn
			}

			attrs := []slog.Attr{
				slog.String("request_id", requestID),
				slog.String("method", req.Method),
				slog.String("path", req.URL.Path),
				slog.Int("status", res.Status),
				slog.Int64("latency_ms", latency.Milliseconds()),
				slog.String("ip", c.RealIP()),
			}
			if err != nil {
				attrs = append(attrs, slog.String("error", err.Error()))
			}
			log.LogAttrs(c.Request().Context(), level, "http request", attrs...)

			return err
		}
	}
}
