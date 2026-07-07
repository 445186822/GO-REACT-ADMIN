package response

import (
	"strconv"

	"github.com/labstack/echo/v4"
)

// PageParams returns parsed page and page_size query parameters clamped to sensible bounds.
// maxPageSize caps the page_size upper bound (default 20, clamped to [1, maxPageSize]).
func PageParams(c echo.Context, maxPageSize int64) (page int64, pageSize int64) {
	page, _ = strconv.ParseInt(c.QueryParam("page"), 10, 64)
	pageSize, _ = strconv.ParseInt(c.QueryParam("page_size"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > maxPageSize {
		pageSize = 20
	}
	return
}
