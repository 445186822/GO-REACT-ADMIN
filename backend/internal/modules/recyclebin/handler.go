package recyclebin

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	db        *pgxpool.Pool
	jwtSecret string
}

func NewHandler(db *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

func (h *Handler) Register(g *echo.Group) {
	group := g.Group("/recycle-bin", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
	group.POST("/:id/restore", h.Restore)
	group.DELETE("/:id", h.Purge)
	group.DELETE("", h.PurgeAll)
}

// LogDeletion records a soft-deleted item into the recycle bin.
// Call this from other modules when soft-deleting records.
func LogDeletion(ctx context.Context, db *pgxpool.Pool, sourceTable string, sourceID int64, summary string, deletedBy int64) error {
	_, err := db.Exec(ctx,
		`INSERT INTO sys_recycled (source_table, source_id, summary, deleted_by, deleted_at) VALUES ($1,$2,$3,$4,$5)`,
		sourceTable, sourceID, summary, deletedBy, time.Now())
	return err
}

// RestoreRecord restores a soft-deleted record by setting deleted_at to NULL.
// Returns true if restored, false if not found or already restored.
func RestoreRecord(ctx context.Context, db *pgxpool.Pool, sourceTable string, sourceID int64) (bool, error) {
	query := fmt.Sprintf(`UPDATE %s SET deleted_at = NULL, updated_at = now() WHERE id = $1 AND deleted_at IS NOT NULL`, safeIdent(sourceTable))
	tag, err := db.Exec(ctx, query, sourceID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

type RecycledRow struct {
	ID          int64  `json:"id"`
	SourceTable string `json:"source_table"`
	SourceID    int64  `json:"source_id"`
	Summary     string `json:"summary"`
	DeletedBy   string `json:"deleted_by"`
	DeletedAt   string `json:"deleted_at"`
}

func (h *Handler) List(c echo.Context) error {
	sourceTable := c.QueryParam("source_table")
	keyword := c.QueryParam("keyword")
	page, pageSize := response.PageParams(c, 100)
	offset := (page - 1) * pageSize

	where := "WHERE ($1 = '' OR r.source_table = $1) AND ($2 = '' OR r.summary ILIKE '%' || $2 || '%')"

	var total int64
	if err := h.db.QueryRow(c.Request().Context(),
		`SELECT count(*) FROM sys_recycled r `+where, sourceTable, keyword).Scan(&total); err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(),
		`SELECT r.id, r.source_table, r.source_id, r.summary, COALESCE(u.display_name, ''), r.deleted_at
		 FROM sys_recycled r
		 LEFT JOIN sys_users u ON u.id = r.deleted_by
		 `+where+`
		 ORDER BY r.deleted_at DESC LIMIT $3 OFFSET $4`,
		sourceTable, keyword, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]RecycledRow, 0)
	for rows.Next() {
		var item RecycledRow
		var t time.Time
		if err := rows.Scan(&item.ID, &item.SourceTable, &item.SourceID, &item.Summary, &item.DeletedBy, &t); err != nil {
			return err
		}
		item.DeletedAt = t.Format("2006-01-02 15:04:05")
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, response.Page[RecycledRow]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) Restore(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}

	var sourceTable string
	var sourceID int64
	if err := h.db.QueryRow(c.Request().Context(),
		`SELECT source_table, source_id FROM sys_recycled WHERE id = $1`, id).Scan(&sourceTable, &sourceID); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "recycled item not found")
	}

	restored, err := RestoreRecord(c.Request().Context(), h.db, sourceTable, sourceID)
	if err != nil {
		return err
	}
	if !restored {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "original record not found or already restored")
	}

	h.db.Exec(c.Request().Context(), `DELETE FROM sys_recycled WHERE id = $1`, id)
	return response.OK(c, map[string]bool{"restored": true})
}

func (h *Handler) Purge(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}

	var sourceTable string
	var sourceID int64
	if err := h.db.QueryRow(c.Request().Context(),
		`SELECT source_table, source_id FROM sys_recycled WHERE id = $1`, id).Scan(&sourceTable, &sourceID); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "recycled item not found")
	}

	query := fmt.Sprintf(`DELETE FROM %s WHERE id = $1 AND deleted_at IS NOT NULL`, safeIdent(sourceTable))
	h.db.Exec(c.Request().Context(), query, sourceID)
	h.db.Exec(c.Request().Context(), `DELETE FROM sys_recycled WHERE id = $1`, id)

	return response.OK(c, map[string]bool{"purged": true})
}

func (h *Handler) PurgeAll(c echo.Context) error {
	sourceTable := c.QueryParam("source_table")

	if sourceTable != "" {
		query := fmt.Sprintf(`DELETE FROM %s WHERE deleted_at IS NOT NULL`, safeIdent(sourceTable))
		h.db.Exec(c.Request().Context(), query)
		h.db.Exec(c.Request().Context(), `DELETE FROM sys_recycled WHERE source_table = $1`, sourceTable)
	} else {
		h.db.Exec(c.Request().Context(), `DELETE FROM sys_recycled`)
	}

	return response.OK(c, map[string]bool{"purged": true})
}


func safeIdent(s string) string {
	for _, ch := range s {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_') {
			return `"` + s + `"`
		}
	}
	return s
}
