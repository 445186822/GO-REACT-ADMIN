package knowledgebase

import (
	"context"
	"net/http"
	"strconv"

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
	group := g.Group("/kb", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	// Categories
	group.GET("/categories", h.ListCategories)
	group.GET("/categories/tree", h.TreeCategories)
	group.POST("/categories", h.CreateCategory)
	group.PUT("/categories/:id", h.UpdateCategory)
	group.DELETE("/categories/:id", h.DeleteCategory)
	// Articles
	group.GET("/articles", h.ListArticles)
	group.GET("/articles/:id", h.GetArticle)
	group.POST("/articles", h.CreateArticle)
	group.PUT("/articles/:id", h.UpdateArticle)
	group.DELETE("/articles/:id", h.DeleteArticle)
	// FAQs
	group.GET("/faqs", h.ListFAQs)
	group.POST("/faqs", h.CreateFAQ)
	group.PUT("/faqs/:id", h.UpdateFAQ)
	group.DELETE("/faqs/:id", h.DeleteFAQ)
}

// --- Categories ---

type CategoryRow struct {
	ID        int64         `json:"id"`
	Name      string        `json:"name"`
	ParentID  *int64        `json:"parent_id"`
	SortOrder int32         `json:"sort_order"`
	Status    string        `json:"status"`
	Children  []CategoryRow `json:"children,omitempty"`
}

type CategoryForm struct {
	Name      string `json:"name"`
	ParentID  *int64 `json:"parent_id"`
	SortOrder int32  `json:"sort_order"`
	Status    string `json:"status"`
}

func (h *Handler) ListCategories(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(),
		`SELECT id, name, parent_id, sort_order, status FROM kb_categories ORDER BY sort_order, id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]CategoryRow, 0)
	for rows.Next() {
		var item CategoryRow
		if err := rows.Scan(&item.ID, &item.Name, &item.ParentID, &item.SortOrder, &item.Status); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, items)
}

func (h *Handler) TreeCategories(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(),
		`SELECT id, name, parent_id, sort_order, status FROM kb_categories ORDER BY sort_order, id`)
	if err != nil {
		return err
	}
	defer rows.Close()

	all := make([]CategoryRow, 0)
	for rows.Next() {
		var item CategoryRow
		if err := rows.Scan(&item.ID, &item.Name, &item.ParentID, &item.SortOrder, &item.Status); err != nil {
			return err
		}
		all = append(all, item)
	}

	tree := buildTree(all, nil)
	return response.OK(c, tree)
}

func buildTree(items []CategoryRow, parentID *int64) []CategoryRow {
	result := make([]CategoryRow, 0)
	for _, item := range items {
		if (parentID == nil && item.ParentID == nil) || (parentID != nil && item.ParentID != nil && *item.ParentID == *parentID) {
			children := buildTree(items, &item.ID)
			if len(children) > 0 {
				item.Children = children
			}
			result = append(result, item)
		}
	}
	return result
}

func (h *Handler) CreateCategory(c echo.Context) error {
	var req CategoryForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Name == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
	}
	if req.Status == "" {
		req.Status = "ENABLED"
	}
	var id int64
	err := h.db.QueryRow(c.Request().Context(),
		`INSERT INTO kb_categories (name, parent_id, sort_order, status) VALUES ($1,$2,$3,$4) RETURNING id`,
		req.Name, req.ParentID, req.SortOrder, req.Status).Scan(&id)
	if err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateCategory(c echo.Context) error {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req CategoryForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	h.db.Exec(c.Request().Context(),
		`UPDATE kb_categories SET name=$2, parent_id=$3, sort_order=$4, status=$5, updated_at=now() WHERE id=$1`,
		id, req.Name, req.ParentID, req.SortOrder, req.Status)
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteCategory(c echo.Context) error {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	usage, err := h.categoryUsage(c.Request().Context(), id)
	if err != nil {
		return err
	}
	if err := categoryDeleteBlocker(usage); err != nil {
		return err
	}
	if _, err := h.db.Exec(c.Request().Context(), `DELETE FROM kb_categories WHERE id = $1`, id); err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

type categoryUsageCounts struct {
	Children int64
	Articles int64
	FAQs     int64
}

func (h *Handler) categoryUsage(ctx context.Context, categoryID int64) (categoryUsageCounts, error) {
	var usage categoryUsageCounts
	err := h.db.QueryRow(ctx, `
SELECT
  (SELECT count(*) FROM kb_categories WHERE parent_id = $1),
  (SELECT count(*) FROM kb_articles WHERE category_id = $1 AND deleted_at IS NULL),
  (SELECT count(*) FROM kb_faqs WHERE category_id = $1 AND deleted_at IS NULL)`, categoryID).
		Scan(&usage.Children, &usage.Articles, &usage.FAQs)
	return usage, err
}

func categoryDeleteBlocker(usage categoryUsageCounts) error {
	if usage.Children == 0 && usage.Articles == 0 && usage.FAQs == 0 {
		return nil
	}
	return response.NewError(http.StatusConflict, "KB_CATEGORY_IN_USE", "category has child categories, articles, or FAQs")
}

// --- Articles ---

type ArticleRow struct {
	ID         int64   `json:"id"`
	Title      string  `json:"title"`
	Content    string  `json:"content"`
	CategoryID *int64  `json:"category_id"`
	Tags       *string `json:"tags"`
	IsPinned   bool    `json:"is_pinned"`
	ViewCount  int64   `json:"view_count"`
	LikeCount  int64   `json:"like_count"`
	Status     string  `json:"status"`
	AuthorName string  `json:"author_name"`
	CreatedAt  string  `json:"created_at"`
}

type ArticleForm struct {
	Title      string  `json:"title"`
	Content    string  `json:"content"`
	CategoryID *int64  `json:"category_id"`
	Tags       *string `json:"tags"`
	IsPinned   bool    `json:"is_pinned"`
	Status     string  `json:"status"`
}

func (h *Handler) ListArticles(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	categoryID := c.QueryParam("category_id")
	status := c.QueryParam("status")
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize

	var total int64
	h.db.QueryRow(c.Request().Context(),
		`SELECT count(*) FROM kb_articles WHERE deleted_at IS NULL
		 AND ($1 = '' OR title ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%' OR COALESCE(tags, '') ILIKE '%' || $1 || '%')
		 AND ($2 = '' OR category_id::text = $2)
		 AND ($3 = '' OR status = $3)`, keyword, categoryID, status).Scan(&total)

	rows, err := h.db.Query(c.Request().Context(),
		`SELECT a.id, a.title, a.content, a.category_id, a.tags, a.is_pinned, a.view_count, a.like_count, a.status,
		 COALESCE(u.display_name, ''), to_char(a.created_at, 'YYYY-MM-DD HH24:MI:SS')
		 FROM kb_articles a LEFT JOIN sys_users u ON u.id = a.author_id
		 WHERE a.deleted_at IS NULL
		 AND ($1 = '' OR a.title ILIKE '%' || $1 || '%' OR a.content ILIKE '%' || $1 || '%' OR COALESCE(a.tags, '') ILIKE '%' || $1 || '%')
		 AND ($2 = '' OR a.category_id::text = $2)
		 AND ($3 = '' OR a.status = $3)
		 ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT $4 OFFSET $5`,
		keyword, categoryID, status, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]ArticleRow, 0)
	for rows.Next() {
		var item ArticleRow
		if err := rows.Scan(&item.ID, &item.Title, &item.Content, &item.CategoryID, &item.Tags,
			&item.IsPinned, &item.ViewCount, &item.LikeCount, &item.Status, &item.AuthorName, &item.CreatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, response.Page[ArticleRow]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) GetArticle(c echo.Context) error {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	h.db.Exec(c.Request().Context(), `UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1`, id)

	var item ArticleRow
	err := h.db.QueryRow(c.Request().Context(),
		`SELECT a.id, a.title, a.content, a.category_id, a.tags, a.is_pinned, a.view_count, a.like_count, a.status,
		 COALESCE(u.display_name, ''), to_char(a.created_at, 'YYYY-MM-DD HH24:MI:SS')
		 FROM kb_articles a LEFT JOIN sys_users u ON u.id = a.author_id
		 WHERE a.id = $1 AND a.deleted_at IS NULL`, id).
		Scan(&item.ID, &item.Title, &item.Content, &item.CategoryID, &item.Tags,
			&item.IsPinned, &item.ViewCount, &item.LikeCount, &item.Status, &item.AuthorName, &item.CreatedAt)
	if err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "article not found")
	}
	return response.OK(c, item)
}

func (h *Handler) CreateArticle(c echo.Context) error {
	userID := middleware.CurrentUserID(c)
	var req ArticleForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Title == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "title is required")
	}
	if req.Status == "" {
		req.Status = "PUBLISHED"
	}
	var id int64
	err := h.db.QueryRow(c.Request().Context(),
		`INSERT INTO kb_articles (title, content, category_id, tags, is_pinned, status, author_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		req.Title, req.Content, req.CategoryID, req.Tags, req.IsPinned, req.Status, userID).Scan(&id)
	if err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateArticle(c echo.Context) error {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req ArticleForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	h.db.Exec(c.Request().Context(),
		`UPDATE kb_articles SET title=$2, content=$3, category_id=$4, tags=$5, is_pinned=$6, status=$7, updated_at=now() WHERE id=$1`,
		id, req.Title, req.Content, req.CategoryID, req.Tags, req.IsPinned, req.Status)
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteArticle(c echo.Context) error {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	h.db.Exec(c.Request().Context(), `UPDATE kb_articles SET deleted_at = now() WHERE id = $1`, id)
	return response.OK(c, map[string]bool{"deleted": true})
}

// --- FAQs ---

type FAQRow struct {
	ID         int64  `json:"id"`
	Question   string `json:"question"`
	Answer     string `json:"answer"`
	CategoryID *int64 `json:"category_id"`
	SortOrder  int32  `json:"sort_order"`
	ViewCount  int64  `json:"view_count"`
	LikeCount  int64  `json:"like_count"`
	Status     string `json:"status"`
}

type FAQForm struct {
	Question   string `json:"question"`
	Answer     string `json:"answer"`
	CategoryID *int64 `json:"category_id"`
	SortOrder  int32  `json:"sort_order"`
	Status     string `json:"status"`
}

func (h *Handler) ListFAQs(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	categoryID := c.QueryParam("category_id")
	status := c.QueryParam("status")
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize

	var total int64
	h.db.QueryRow(c.Request().Context(),
		`SELECT count(*) FROM kb_faqs WHERE deleted_at IS NULL
		 AND ($1 = '' OR question ILIKE '%' || $1 || '%' OR answer ILIKE '%' || $1 || '%')
		 AND ($2 = '' OR category_id::text = $2)
		 AND ($3 = '' OR status = $3)`, keyword, categoryID, status).Scan(&total)

	rows, err := h.db.Query(c.Request().Context(),
		`SELECT id, question, answer, category_id, sort_order, view_count, like_count, status
		 FROM kb_faqs WHERE deleted_at IS NULL
		 AND ($1 = '' OR question ILIKE '%' || $1 || '%' OR answer ILIKE '%' || $1 || '%')
		 AND ($2 = '' OR category_id::text = $2)
		 AND ($3 = '' OR status = $3)
		 ORDER BY sort_order, id LIMIT $4 OFFSET $5`, keyword, categoryID, status, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]FAQRow, 0)
	for rows.Next() {
		var item FAQRow
		if err := rows.Scan(&item.ID, &item.Question, &item.Answer, &item.CategoryID, &item.SortOrder, &item.ViewCount, &item.LikeCount, &item.Status); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, response.Page[FAQRow]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) CreateFAQ(c echo.Context) error {
	var req FAQForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Question == "" || req.Answer == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "question and answer are required")
	}
	if req.Status == "" {
		req.Status = "ENABLED"
	}
	var id int64
	err := h.db.QueryRow(c.Request().Context(),
		`INSERT INTO kb_faqs (question, answer, category_id, sort_order, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		req.Question, req.Answer, req.CategoryID, req.SortOrder, req.Status).Scan(&id)
	if err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateFAQ(c echo.Context) error {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req FAQForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	h.db.Exec(c.Request().Context(),
		`UPDATE kb_faqs SET question=$2, answer=$3, category_id=$4, sort_order=$5, status=$6, updated_at=now() WHERE id=$1`,
		id, req.Question, req.Answer, req.CategoryID, req.SortOrder, req.Status)
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteFAQ(c echo.Context) error {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	h.db.Exec(c.Request().Context(), `UPDATE kb_faqs SET deleted_at = now() WHERE id = $1`, id)
	return response.OK(c, map[string]bool{"deleted": true})
}

func pagination(c echo.Context) (int64, int64) {
	page, _ := strconv.ParseInt(c.QueryParam("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.QueryParam("page_size"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}
