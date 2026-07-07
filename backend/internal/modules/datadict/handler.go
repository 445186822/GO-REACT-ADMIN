package datadict

import (
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
	group := g.Group("/dict", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("/types", h.ListTypes)
	group.GET("/types/tree", h.TreeTypes)
	group.POST("/types", h.CreateType)
	group.PUT("/types/:id", h.UpdateType)
	group.DELETE("/types/:id", h.DeleteType)
	group.GET("/types/:id/items", h.ListItems)
	group.POST("/types/:id/items", h.CreateItem)
	group.PUT("/items/:id", h.UpdateItem)
	group.DELETE("/items/:id", h.DeleteItem)
	group.PUT("/items/batch-sort", h.BatchSortItems)
}

// --- Types ---

type DictTypeRow struct {
	ID        int64   `json:"id"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	Remark    *string `json:"remark"`
	SortOrder int32   `json:"sort_order"`
}

type DictTypeForm struct {
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	Remark    *string `json:"remark"`
	SortOrder int32   `json:"sort_order"`
}

func (h *Handler) ListTypes(c echo.Context) error {
	keyword := c.QueryParam("keyword")
	page, pageSize := response.PageParams(c, 1000)
	offset := (page - 1) * pageSize

	var total int64
	if err := h.db.QueryRow(c.Request().Context(),
		`SELECT count(*) FROM sys_dict_types WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR code ILIKE '%' || $1 || '%')`,
		keyword).Scan(&total); err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(),
		`SELECT id, code, name, status, remark, sort_order FROM sys_dict_types
		 WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR code ILIKE '%' || $1 || '%')
		 ORDER BY sort_order ASC, id ASC LIMIT $2 OFFSET $3`,
		keyword, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]DictTypeRow, 0)
	for rows.Next() {
		var item DictTypeRow
		if err := rows.Scan(&item.ID, &item.Code, &item.Name, &item.Status, &item.Remark, &item.SortOrder); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, response.Page[DictTypeRow]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) TreeTypes(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(),
		`SELECT dt.id, dt.code, dt.name, dt.status, dt.remark, dt.sort_order,
		        di.id, di.label, di.value, di.status, di.remark, di.sort_order
		 FROM sys_dict_types dt
		 LEFT JOIN sys_dict_items di ON di.type_id = dt.id
		 ORDER BY dt.sort_order ASC, dt.id ASC, di.sort_order ASC, di.id ASC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type ItemNode struct {
		ID        int64   `json:"id"`
		Label     string  `json:"label"`
		Value     string  `json:"value"`
		Status    string  `json:"status"`
		Remark    *string `json:"remark"`
		SortOrder int32   `json:"sort_order"`
	}
	type TypeNode struct {
		ID        int64      `json:"id"`
		Code      string     `json:"code"`
		Name      string     `json:"name"`
		Status    string     `json:"status"`
		Remark    *string    `json:"remark"`
		SortOrder int32      `json:"sort_order"`
		Children  []ItemNode `json:"children"`
	}

	types := make([]TypeNode, 0)
	typeIdx := make(map[int64]int)

	for rows.Next() {
		var typeID int64
		var code, name, status string
		var remark *string
		var sortOrder int32
		var itemID *int64
		var label, value, itemStatus *string
		var itemRemark *string
		var itemSortOrder *int32

		if err := rows.Scan(&typeID, &code, &name, &status, &remark, &sortOrder,
			&itemID, &label, &value, &itemStatus, &itemRemark, &itemSortOrder); err != nil {
			return err
		}

		if idx, ok := typeIdx[typeID]; !ok {
			types = append(types, TypeNode{
				ID: typeID, Code: code, Name: name, Status: status,
				Remark: remark, SortOrder: sortOrder, Children: make([]ItemNode, 0),
			})
			typeIdx[typeID] = len(types) - 1
			idx = len(types) - 1
			_ = idx
		}

		if itemID != nil {
			idx := typeIdx[typeID]
			types[idx].Children = append(types[idx].Children, ItemNode{
				ID: *itemID, Label: *label, Value: *value, Status: *itemStatus,
				Remark: itemRemark, SortOrder: *itemSortOrder,
			})
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, types)
}

func (h *Handler) CreateType(c echo.Context) error {
	var req DictTypeForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Code == "" || req.Name == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "code and name are required")
	}
	if req.Status == "" {
		req.Status = "ENABLED"
	}
	var id int64
	if err := h.db.QueryRow(c.Request().Context(),
		`INSERT INTO sys_dict_types (code, name, status, remark, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		req.Code, req.Name, req.Status, req.Remark, req.SortOrder).Scan(&id); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateType(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req DictTypeForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	tag, err := h.db.Exec(c.Request().Context(),
		`UPDATE sys_dict_types SET code=$2, name=$3, status=$4, remark=$5, sort_order=$6, updated_at=now() WHERE id=$1`,
		id, req.Code, req.Name, req.Status, req.Remark, req.SortOrder)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "dict type not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteType(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	if _, err := h.db.Exec(c.Request().Context(), `DELETE FROM sys_dict_items WHERE type_id = $1`, id); err != nil {
		return err
	}
	tag, err := h.db.Exec(c.Request().Context(), `DELETE FROM sys_dict_types WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "dict type not found")
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

// --- Items ---

type DictItemRow struct {
	ID        int64   `json:"id"`
	TypeID    int64   `json:"type_id"`
	Label     string  `json:"label"`
	Value     string  `json:"value"`
	Status    string  `json:"status"`
	Remark    *string `json:"remark"`
	SortOrder int32   `json:"sort_order"`
}

type DictItemForm struct {
	Label     string  `json:"label"`
	Value     string  `json:"value"`
	Status    string  `json:"status"`
	Remark    *string `json:"remark"`
	SortOrder int32   `json:"sort_order"`
}

type BatchSortItem struct {
	ID        int64 `json:"id"`
	SortOrder int32 `json:"sort_order"`
}

func (h *Handler) ListItems(c echo.Context) error {
	typeID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid type id")
	}
	rows, err := h.db.Query(c.Request().Context(),
		`SELECT id, type_id, label, value, status, remark, sort_order FROM sys_dict_items
		 WHERE type_id = $1 ORDER BY sort_order ASC, id ASC`, typeID)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]DictItemRow, 0)
	for rows.Next() {
		var item DictItemRow
		if err := rows.Scan(&item.ID, &item.TypeID, &item.Label, &item.Value, &item.Status, &item.Remark, &item.SortOrder); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) CreateItem(c echo.Context) error {
	typeID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid type id")
	}
	var req DictItemForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.Label == "" || req.Value == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "label and value are required")
	}
	if req.Status == "" {
		req.Status = "ENABLED"
	}
	var id int64
	if err := h.db.QueryRow(c.Request().Context(),
		`INSERT INTO sys_dict_items (type_id, label, value, status, remark, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		typeID, req.Label, req.Value, req.Status, req.Remark, req.SortOrder).Scan(&id); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) UpdateItem(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req DictItemForm
	if err := c.Bind(&req); err != nil {
		return err
	}
	tag, err := h.db.Exec(c.Request().Context(),
		`UPDATE sys_dict_items SET label=$2, value=$3, status=$4, remark=$5, sort_order=$6, updated_at=now() WHERE id=$1`,
		id, req.Label, req.Value, req.Status, req.Remark, req.SortOrder)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "dict item not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) DeleteItem(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	tag, err := h.db.Exec(c.Request().Context(), `DELETE FROM sys_dict_items WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "dict item not found")
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

func (h *Handler) BatchSortItems(c echo.Context) error {
	var items []BatchSortItem
	if err := c.Bind(&items); err != nil {
		return err
	}
	for _, item := range items {
		if _, err := h.db.Exec(c.Request().Context(),
			`UPDATE sys_dict_items SET sort_order=$2, updated_at=now() WHERE id=$1`,
			item.ID, item.SortOrder); err != nil {
			return err
		}
	}
	return response.OK(c, map[string]bool{"sorted": true})
}

