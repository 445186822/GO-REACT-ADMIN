package middleware

import (
	"net/http"
	"strings"

	"enterprise-demo/backend/internal/auth"
	"enterprise-demo/backend/internal/http/response"

	"github.com/labstack/echo/v4"
)

const CurrentUserIDKey = "current_user_id"

func Auth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get(echo.HeaderAuthorization)
			if !strings.HasPrefix(header, "Bearer ") {
				return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "missing bearer token")
			}
			claims, err := auth.Parse(secret, strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "invalid token")
			}
			c.Set(CurrentUserIDKey, claims.UserID)
			return next(c)
		}
	}
}

func CurrentUserID(c echo.Context) int64 {
	userID, _ := c.Get(CurrentUserIDKey).(int64)
	return userID
}
