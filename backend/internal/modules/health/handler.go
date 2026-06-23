package health

import (
	"enterprise-demo/backend/internal/http/response"

	"github.com/labstack/echo/v4"
)

func Handle(c echo.Context) error {
	return response.OK(c, map[string]string{
		"status": "ok",
	})
}
