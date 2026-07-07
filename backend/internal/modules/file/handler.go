package file

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path"
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
	uploadDir string
}

func NewHandler(db *pgxpool.Pool, jwtSecret string, uploadDir string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret, uploadDir: uploadDir}
}

func (h *Handler) Register(g *echo.Group) {
	group := g.Group("/files", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
	group.POST("/upload", h.Upload)
	group.GET("/:id/download", h.Download)
	group.DELETE("/:id", h.Delete)
}

type Row struct {
	ID           int64     `json:"id"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	Size         int64     `json:"size"`
	UploaderID   int64     `json:"uploader_id"`
	Uploader     string    `json:"uploader"`
	BizType      *string   `json:"biz_type"`
	BizID        *int64    `json:"biz_id"`
	CreatedAt    time.Time `json:"created_at"`
}

func (h *Handler) List(c echo.Context) error {
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize
	keyword := c.QueryParam("keyword")

	var total int64
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT count(*)
FROM sys_files
WHERE deleted_at IS NULL
  AND ($1 = '' OR original_name ILIKE '%' || $1 || '%')`, keyword).Scan(&total); err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(), `
SELECT f.id, f.original_name, f.mime_type, f.size, f.uploader_id, u.display_name, f.biz_type, f.biz_id, f.created_at
FROM sys_files f
JOIN sys_users u ON u.id = f.uploader_id
WHERE f.deleted_at IS NULL
  AND ($1 = '' OR f.original_name ILIKE '%' || $1 || '%')
ORDER BY f.created_at DESC
LIMIT $2 OFFSET $3`, keyword, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.OriginalName, &item.MimeType, &item.Size, &item.UploaderID, &item.Uploader, &item.BizType, &item.BizID, &item.CreatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, response.Page[Row]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) Upload(c echo.Context) error {
	header, err := c.FormFile("file")
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "file is required")
	}
	src, err := header.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	if err := os.MkdirAll(h.uploadDir, 0o755); err != nil {
		return err
	}
	storedName := randomName() + path.Ext(header.Filename)
	storagePath := path.Join(h.uploadDir, storedName)
	dst, err := os.Create(storagePath)
	if err != nil {
		return err
	}
	defer dst.Close()

	size, err := io.Copy(dst, src)
	if err != nil {
		return err
	}

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	userID := middleware.CurrentUserID(c)
	var id int64
	if err := h.db.QueryRow(c.Request().Context(), `
INSERT INTO sys_files (original_name, storage_path, mime_type, size, uploader_id, biz_type)
VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))
RETURNING id`, header.Filename, storagePath, mimeType, size, userID, c.FormValue("biz_type")).Scan(&id); err != nil {
		_ = os.Remove(storagePath)
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) Download(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var originalName, storagePath string
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT original_name, storage_path
FROM sys_files
WHERE id = $1 AND deleted_at IS NULL`, id).Scan(&originalName, &storagePath); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "file not found")
	}
	return c.Inline(storagePath, originalName)
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	tag, err := h.db.Exec(c.Request().Context(), `UPDATE sys_files SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "file not found")
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

func pagination(c echo.Context) (int64, int64) {
	page, _ := strconv.ParseInt(c.QueryParam("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.QueryParam("page_size"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 10000 {
		pageSize = 20
	}
	return page, pageSize
}

func randomName() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return hex.EncodeToString(b[:])
}
