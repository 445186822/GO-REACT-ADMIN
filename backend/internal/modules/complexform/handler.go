package complexform

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

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
	group := g.Group("/complex-forms", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
}

type Row struct {
	ID              int64           `json:"id"`
	Title           string          `json:"title"`
	Applicant       string          `json:"applicant"`
	Department      string          `json:"department"`
	Category        string          `json:"category"`
	Priority        string          `json:"priority"`
	Status          string          `json:"status"`
	Amount          *float64        `json:"amount"`
	Quantity        *int64          `json:"quantity"`
	Score           *int64          `json:"score"`
	Progress        *int64          `json:"progress"`
	Rating          *int64          `json:"rating"`
	Enabled         bool            `json:"enabled"`
	StartDate       *string         `json:"start_date"`
	EndDate         *string         `json:"end_date"`
	AppointmentTime *string         `json:"appointment_time"`
	ContactName     *string         `json:"contact_name"`
	ContactPhone    *string         `json:"contact_phone"`
	ContactEmail    *string         `json:"contact_email"`
	AttachmentURL   *string         `json:"attachment_url"`
	FormExtra       json.RawMessage `json:"form_extra"`
	Remark          *string         `json:"remark"`
	CreatedAt       string          `json:"created_at"`
}

type Form struct {
	Title           string          `json:"title"`
	Applicant       string          `json:"applicant"`
	Department      string          `json:"department"`
	Category        string          `json:"category"`
	Priority        string          `json:"priority"`
	Status          string          `json:"status"`
	Amount          *float64        `json:"amount"`
	Quantity        *int64          `json:"quantity"`
	Score           *int64          `json:"score"`
	Progress        *int64          `json:"progress"`
	Rating          *int64          `json:"rating"`
	Enabled         *bool           `json:"enabled"`
	StartDate       *string         `json:"start_date"`
	EndDate         *string         `json:"end_date"`
	AppointmentTime *string         `json:"appointment_time"`
	ContactName     *string         `json:"contact_name"`
	ContactPhone    *string         `json:"contact_phone"`
	ContactEmail    *string         `json:"contact_email"`
	AttachmentURL   *string         `json:"attachment_url"`
	FormExtra       json.RawMessage `json:"form_extra"`
	Remark          *string         `json:"remark"`
}

func (h *Handler) List(c echo.Context) error {
	keyword := strings.TrimSpace(c.QueryParam("keyword"))
	status := strings.TrimSpace(c.QueryParam("status"))
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize

	var total int64
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT count(*)
FROM biz_complex_forms
WHERE deleted_at IS NULL
  AND ($1 = '' OR title ILIKE '%' || $1 || '%' OR applicant ILIKE '%' || $1 || '%')
  AND ($2 = '' OR status = $2)`, keyword, status).Scan(&total); err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(), `
SELECT id, title, applicant, department, category, priority, status,
       amount::float8, quantity, score, progress, rating, enabled,
       to_char(start_date, 'YYYY-MM-DD'), to_char(end_date, 'YYYY-MM-DD'), to_char(appointment_time, 'HH24:MI:SS'),
       contact_name, contact_phone, contact_email, attachment_url, form_extra, remark,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS')
FROM biz_complex_forms
WHERE deleted_at IS NULL
  AND ($1 = '' OR title ILIKE '%' || $1 || '%' OR applicant ILIKE '%' || $1 || '%')
  AND ($2 = '' OR status = $2)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4`, keyword, status, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		var formExtra []byte
		if err := rows.Scan(
			&item.ID, &item.Title, &item.Applicant, &item.Department, &item.Category, &item.Priority, &item.Status,
			&item.Amount, &item.Quantity, &item.Score, &item.Progress, &item.Rating, &item.Enabled,
			&item.StartDate, &item.EndDate, &item.AppointmentTime,
			&item.ContactName, &item.ContactPhone, &item.ContactEmail, &item.AttachmentURL, &formExtra, &item.Remark,
			&item.CreatedAt,
		); err != nil {
			return err
		}
		item.FormExtra = json.RawMessage(formExtra)
		items = append(items, item)
	}
	return response.OK(c, response.Page[Row]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) Create(c echo.Context) error {
	var form Form
	if err := c.Bind(&form); err != nil {
		return err
	}
	if err := validateForm(&form); err != nil {
		return err
	}

	var id int64
	if err := h.db.QueryRow(c.Request().Context(), `
INSERT INTO biz_complex_forms (
  title, applicant, department, category, priority, status, amount, quantity, score, progress, rating, enabled,
  start_date, end_date, appointment_time, contact_name, contact_phone, contact_email, attachment_url, form_extra, remark
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
  $13, $14, $15, $16, $17, $18, $19, $20, $21
) RETURNING id`,
		form.Title, form.Applicant, form.Department, form.Category, form.Priority, form.Status,
		form.Amount, form.Quantity, form.Score, form.Progress, form.Rating, enabledValue(form.Enabled),
		form.StartDate, form.EndDate, form.AppointmentTime, form.ContactName, form.ContactPhone, form.ContactEmail,
		form.AttachmentURL, string(normalizedExtra(form.FormExtra)), form.Remark,
	).Scan(&id); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var form Form
	if err := c.Bind(&form); err != nil {
		return err
	}
	if err := validateForm(&form); err != nil {
		return err
	}

	tag, err := h.db.Exec(c.Request().Context(), `
UPDATE biz_complex_forms
SET title = $2, applicant = $3, department = $4, category = $5, priority = $6, status = $7,
    amount = $8, quantity = $9, score = $10, progress = $11, rating = $12, enabled = $13,
    start_date = $14, end_date = $15, appointment_time = $16,
    contact_name = $17, contact_phone = $18, contact_email = $19, attachment_url = $20,
    form_extra = $21, remark = $22, updated_at = now()
WHERE id = $1 AND deleted_at IS NULL`,
		id, form.Title, form.Applicant, form.Department, form.Category, form.Priority, form.Status,
		form.Amount, form.Quantity, form.Score, form.Progress, form.Rating, enabledValue(form.Enabled),
		form.StartDate, form.EndDate, form.AppointmentTime, form.ContactName, form.ContactPhone, form.ContactEmail,
		form.AttachmentURL, string(normalizedExtra(form.FormExtra)), form.Remark,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "complex form not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	tag, err := h.db.Exec(c.Request().Context(), `UPDATE biz_complex_forms SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "complex form not found")
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

func validateForm(form *Form) error {
	normalizeForm(form)
	if form.Title == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "title is required")
	}
	if form.Applicant == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "applicant is required")
	}
	if form.Department == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "department is required")
	}
	if !json.Valid(normalizedExtra(form.FormExtra)) {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "form_extra must be valid json")
	}
	return nil
}

func normalizeForm(form *Form) {
	form.Title = strings.TrimSpace(form.Title)
	form.Applicant = strings.TrimSpace(form.Applicant)
	form.Department = strings.TrimSpace(form.Department)
	form.Category = strings.TrimSpace(form.Category)
	form.Priority = strings.TrimSpace(form.Priority)
	form.Status = strings.TrimSpace(form.Status)
	form.StartDate = trimStringPtr(form.StartDate)
	form.EndDate = trimStringPtr(form.EndDate)
	form.AppointmentTime = trimStringPtr(form.AppointmentTime)
	form.ContactName = trimStringPtr(form.ContactName)
	form.ContactPhone = trimStringPtr(form.ContactPhone)
	form.ContactEmail = trimStringPtr(form.ContactEmail)
	form.AttachmentURL = trimStringPtr(form.AttachmentURL)
	form.Remark = trimStringPtr(form.Remark)
	if form.Category == "" {
		form.Category = "PROCUREMENT"
	}
	if form.Priority == "" {
		form.Priority = "MEDIUM"
	}
	if form.Status == "" {
		form.Status = "DRAFT"
	}
}

func normalizedExtra(value json.RawMessage) []byte {
	if len(value) == 0 {
		return []byte("{}")
	}
	return value
}

func enabledValue(value *bool) bool {
	if value == nil {
		return true
	}
	return *value
}

func trimStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
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
