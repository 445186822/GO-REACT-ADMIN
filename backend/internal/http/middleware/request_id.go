package middleware

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/labstack/echo/v4"
)

const RequestIDKey = "request_id"

func RequestID() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			requestID := c.Request().Header.Get(echo.HeaderXRequestID)
			if requestID == "" {
				requestID = newRequestID()
			}
			c.Set(RequestIDKey, requestID)
			c.Response().Header().Set(echo.HeaderXRequestID, requestID)
			return next(c)
		}
	}
}

func newRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "req_unknown"
	}
	return "req_" + hex.EncodeToString(b[:])
}
