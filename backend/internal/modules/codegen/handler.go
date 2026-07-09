package codegen

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"text/template"

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
	group := g.Group("/code-generator", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("/tables", h.ListTables)
	group.GET("/tables/:table/columns", h.ListColumns)
	group.POST("/preview", h.Preview)
	group.POST("/generate", h.Generate)
}

type TableMeta struct {
	Name string `json:"name"`
}

type ColumnMeta struct {
	Name           string `json:"name"`
	DataType       string `json:"data_type"`
	IsNullable     bool   `json:"is_nullable"`
	HasDefault     bool   `json:"has_default"`
	IsPrimaryKey   bool   `json:"is_primary_key"`
	TypeScriptType string `json:"typescript_type"`
	FormType       string `json:"form_type"`
	Editable       bool   `json:"editable"`
}

type TypeMapping struct {
	TypeScriptType string
	FormType       string
}

type GenerateRequest struct {
	TableName        string       `json:"table_name"`
	FeatureName      string       `json:"feature_name"`
	ModuleName       string       `json:"module_name"`
	RoutePath        string       `json:"route_path"`
	PermissionPrefix string       `json:"permission_prefix"`
	MenuIcon         string       `json:"menu_icon"`
	Overwrite        bool         `json:"overwrite"`
	Columns          []ColumnMeta `json:"columns"`
}

type GeneratedFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Exists  bool   `json:"exists"`
}

var (
	businessTablePattern = regexp.MustCompile(`^biz_[a-z0-9_]+$`)
	namePattern          = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	permissionPattern    = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)
	routePattern         = regexp.MustCompile(`^/business/[a-z0-9-]+$`)
	reservedModules      = map[string]struct{}{"sys": {}, "user": {}, "role": {}, "menu": {}, "auth": {}, "audit": {}}
)

func (h *Handler) ListTables(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = current_schema()
  AND table_type = 'BASE TABLE'
  AND table_name LIKE 'biz\_%' ESCAPE '\'
ORDER BY table_name`)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]TableMeta, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		if isAllowedBusinessTable(name) {
			items = append(items, TableMeta{Name: name})
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *Handler) ListColumns(c echo.Context) error {
	table := c.Param("table")
	if !isAllowedBusinessTable(table) {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid business table")
	}
	columns, err := h.columns(c, table)
	if err != nil {
		return err
	}
	return response.OK(c, columns)
}

func (h *Handler) Preview(c echo.Context) error {
	req, err := h.bindGenerateRequest(c)
	if err != nil {
		return err
	}
	next, err := nextMigrationNumber()
	if err != nil {
		return err
	}
	files, err := buildPreview(req, next)
	if err != nil {
		return err
	}
	root, _ := repoRoot()
	for i := range files {
		files[i].Exists = fileExists(filepath.Join(root, filepath.FromSlash(files[i].Path)))
	}
	return response.OK(c, map[string]any{"files": files})
}

func (h *Handler) Generate(c echo.Context) error {
	req, err := h.bindGenerateRequest(c)
	if err != nil {
		return err
	}
	next, err := nextMigrationNumber()
	if err != nil {
		return err
	}
	files, err := buildPreview(req, next)
	if err != nil {
		return err
	}
	root, err := repoRoot()
	if err != nil {
		return err
	}
	for _, file := range files {
		target := filepath.Join(root, filepath.FromSlash(file.Path))
		if fileExists(target) && !req.Overwrite {
			return response.NewError(http.StatusConflict, "FILE_EXISTS", fmt.Sprintf("target file exists: %s", file.Path))
		}
	}
	for _, file := range files {
		target := filepath.Join(root, filepath.FromSlash(file.Path))
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(target, []byte(file.Content), 0644); err != nil {
			return err
		}
	}
	return response.OK(c, map[string]any{"files": files})
}

func (h *Handler) bindGenerateRequest(c echo.Context) (GenerateRequest, error) {
	var req GenerateRequest
	if err := c.Bind(&req); err != nil {
		return req, err
	}
	var err error
	req.ModuleName, err = normalizeModuleName(req.ModuleName)
	if err != nil {
		return req, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
	}
	if !isAllowedBusinessTable(req.TableName) {
		return req, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid business table")
	}
	if strings.TrimSpace(req.FeatureName) == "" {
		return req, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "feature_name is required")
	}
	if !permissionPattern.MatchString(req.PermissionPrefix) {
		return req, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid permission_prefix")
	}
	if !routePattern.MatchString(req.RoutePath) {
		return req, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "route_path must be under /business")
	}
	if req.MenuIcon == "" {
		req.MenuIcon = "CodeOutlined"
	}
	columns, err := h.columns(c, req.TableName)
	if err != nil {
		return req, err
	}
	req.Columns = columns
	if !hasPrimaryKey(req.Columns) {
		return req, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "table must have a primary key")
	}
	if !hasSupportedPrimaryKey(req.Columns) {
		return req, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "table must have an integer primary key")
	}
	return req, nil
}

func (h *Handler) columns(c echo.Context, table string) ([]ColumnMeta, error) {
	rows, err := h.db.Query(c.Request().Context(), `
SELECT c.column_name,
       c.data_type,
       c.is_nullable = 'YES' AS is_nullable,
       c.column_default IS NOT NULL AS has_default,
       EXISTS (
         SELECT 1
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = c.table_schema
           AND tc.table_name = c.table_name
           AND kcu.column_name = c.column_name
       ) AS is_primary_key
FROM information_schema.columns c
WHERE c.table_schema = current_schema() AND c.table_name = $1
ORDER BY c.ordinal_position`, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]ColumnMeta, 0)
	for rows.Next() {
		var col ColumnMeta
		if err := rows.Scan(&col.Name, &col.DataType, &col.IsNullable, &col.HasDefault, &col.IsPrimaryKey); err != nil {
			return nil, err
		}
		mapping := mapColumnType(col.DataType)
		col.TypeScriptType = mapping.TypeScriptType
		col.FormType = mapping.FormType
		col.Editable = isEditableColumn(col)
		columns = append(columns, col)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(columns) == 0 {
		return nil, response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "business table not found")
	}
	return columns, nil
}

func isAllowedBusinessTable(table string) bool {
	return businessTablePattern.MatchString(table)
}

func normalizeModuleName(name string) (string, error) {
	value := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(name), "_", ""))
	if !regexp.MustCompile(`^[a-z][a-z0-9]*$`).MatchString(value) {
		return "", fmt.Errorf("invalid module_name")
	}
	if _, ok := reservedModules[value]; ok || strings.HasPrefix(value, "sys") {
		return "", fmt.Errorf("reserved module_name")
	}
	return value, nil
}

func mapColumnType(dataType string) TypeMapping {
	switch strings.ToLower(dataType) {
	case "text", "character varying", "character", "varchar", "char", "uuid":
		return TypeMapping{TypeScriptType: "string", FormType: "text"}
	case "smallint", "integer", "bigint", "numeric", "decimal", "real", "double precision":
		return TypeMapping{TypeScriptType: "number", FormType: "number"}
	case "boolean":
		return TypeMapping{TypeScriptType: "boolean", FormType: "switch"}
	case "date":
		return TypeMapping{TypeScriptType: "string", FormType: "date"}
	case "timestamp without time zone", "timestamp with time zone":
		return TypeMapping{TypeScriptType: "string", FormType: "datetime"}
	case "json", "jsonb":
		return TypeMapping{TypeScriptType: "unknown", FormType: "textarea"}
	default:
		return TypeMapping{TypeScriptType: "unknown", FormType: "readonly"}
	}
}

func buildPreview(req GenerateRequest, migrationNumber int) ([]GeneratedFile, error) {
	if !isAllowedBusinessTable(req.TableName) {
		return nil, fmt.Errorf("invalid business table")
	}
	moduleName, err := normalizeModuleName(req.ModuleName)
	if err != nil {
		return nil, err
	}
	req.ModuleName = moduleName
	if req.MenuIcon == "" {
		req.MenuIcon = "CodeOutlined"
	}
	if req.PermissionPrefix == "" {
		req.PermissionPrefix = moduleName
	}
	if !permissionPattern.MatchString(req.PermissionPrefix) {
		return nil, fmt.Errorf("invalid permission prefix")
	}
	if !routePattern.MatchString(req.RoutePath) {
		return nil, fmt.Errorf("invalid route path")
	}
	if !hasPrimaryKey(req.Columns) {
		return nil, fmt.Errorf("primary key required")
	}
	primaryKey, ok := primaryKeyColumn(req.Columns)
	if !ok || !isIntegerColumn(primaryKey) {
		return nil, fmt.Errorf("integer primary key required")
	}
	routeLeaf := strings.TrimPrefix(req.RoutePath, "/business/")
	apiName := routeLeaf
	frontendRoute := strings.TrimPrefix(req.RoutePath, "/")
	pageName := pascal(moduleName) + "ListPage"

	model := map[string]any{
		"Req":             req,
		"Package":         moduleName,
		"RouteLeaf":       routeLeaf,
		"FrontendRoute":   frontendRoute,
		"APIName":         apiName,
		"PageName":        pageName,
		"TypeName":        pascal(moduleName) + "Row",
		"FormName":        pascal(moduleName) + "Form",
		"EditableColumns": editableColumns(req.Columns),
		"ListColumns":     listColumns(req.Columns),
		"PrimaryKey":      primaryKey,
		"HasDeletedAt":    hasColumn(req.Columns, "deleted_at"),
	}

	files := []GeneratedFile{
		{Path: fmt.Sprintf("backend/internal/modules/%s/handler.go", moduleName), Content: renderTemplate(generatedBackendTemplate, model)},
		{Path: fmt.Sprintf("frontend/src/api/%s.ts", apiName), Content: renderTemplate(generatedAPITemplate, model)},
		{Path: fmt.Sprintf("frontend/src/features/%s/pages/%s.tsx", moduleName, pageName), Content: renderTemplate(generatedPageTemplate, model)},
		{Path: fmt.Sprintf("backend/migrations/%06d_%s_menu.up.sql", migrationNumber, moduleName), Content: renderTemplate(generatedMenuUpTemplate, model)},
		{Path: fmt.Sprintf("backend/migrations/%06d_%s_menu.down.sql", migrationNumber, moduleName), Content: renderTemplate(generatedMenuDownTemplate, model)},
		{Path: fmt.Sprintf("docs/generated/%s_integration.md", moduleName), Content: renderTemplate(generatedIntegrationTemplate, model)},
	}
	return files, nil
}

func renderTemplate(source string, data any) string {
	tpl := template.Must(template.New("generated").Funcs(template.FuncMap{
		"pascal":      pascal,
		"camel":       camel,
		"jsonName":    func(name string) string { return name },
		"quote":       strconv.Quote,
		"tsType":      func(col ColumnMeta) string { return mapColumnType(col.DataType).TypeScriptType },
		"goType":      goType,
		"formElement": formElement,
		"add":         func(a int, b int) int { return a + b },
		"hasColumn":   hasColumn,
	}).Parse(source))
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, data); err != nil {
		panic(err)
	}
	return buf.String()
}

func editableColumns(columns []ColumnMeta) []ColumnMeta {
	items := make([]ColumnMeta, 0)
	for _, col := range columns {
		if col.TypeScriptType == "" {
			mapping := mapColumnType(col.DataType)
			col.TypeScriptType = mapping.TypeScriptType
			col.FormType = mapping.FormType
		}
		col.Editable = isEditableColumn(col)
		if col.Editable {
			items = append(items, col)
		}
	}
	return items
}

func listColumns(columns []ColumnMeta) []ColumnMeta {
	items := make([]ColumnMeta, 0)
	for _, col := range columns {
		if col.Name == "deleted_at" {
			continue
		}
		if col.TypeScriptType == "" {
			mapping := mapColumnType(col.DataType)
			col.TypeScriptType = mapping.TypeScriptType
			col.FormType = mapping.FormType
		}
		items = append(items, col)
	}
	return items
}

func isEditableColumn(col ColumnMeta) bool {
	if col.IsPrimaryKey {
		return false
	}
	switch col.Name {
	case "id", "created_at", "updated_at", "deleted_at":
		return false
	default:
		return mapColumnType(col.DataType).FormType != "readonly"
	}
}

func hasPrimaryKey(columns []ColumnMeta) bool {
	count := 0
	for _, col := range columns {
		if col.IsPrimaryKey {
			count++
		}
	}
	return count == 1
}

func hasSupportedPrimaryKey(columns []ColumnMeta) bool {
	col, ok := primaryKeyColumn(columns)
	return ok && isIntegerColumn(col)
}

func primaryKeyColumn(columns []ColumnMeta) (ColumnMeta, bool) {
	var pk ColumnMeta
	count := 0
	for _, col := range columns {
		if col.IsPrimaryKey {
			pk = col
			count++
		}
	}
	return pk, count == 1
}

func isIntegerColumn(col ColumnMeta) bool {
	switch strings.ToLower(col.DataType) {
	case "smallint", "integer", "bigint":
		return true
	default:
		return false
	}
}

func hasColumn(columns []ColumnMeta, name string) bool {
	for _, col := range columns {
		if col.Name == name {
			return true
		}
	}
	return false
}

func pascal(value string) string {
	parts := regexp.MustCompile(`[^a-zA-Z0-9]+`).Split(value, -1)
	var out strings.Builder
	for _, part := range parts {
		if part == "" {
			continue
		}
		lower := strings.ToLower(part)
		out.WriteString(strings.ToUpper(lower[:1]))
		if len(lower) > 1 {
			out.WriteString(lower[1:])
		}
	}
	return out.String()
}

func camel(value string) string {
	p := pascal(value)
	if p == "" {
		return ""
	}
	return strings.ToLower(p[:1]) + p[1:]
}

func formElement(col ColumnMeta) string {
	switch mapColumnType(col.DataType).FormType {
	case "number":
		return "ProFormDigit"
	case "textarea":
		return "ProFormTextArea"
	default:
		return "ProFormText"
	}
}

func goType(col ColumnMeta) string {
	if col.IsPrimaryKey {
		return "int64"
	}
	switch mapColumnType(col.DataType).TypeScriptType {
	case "number":
		if col.IsNullable {
			return "*float64"
		}
		return "float64"
	case "boolean":
		if col.IsNullable {
			return "*bool"
		}
		return "bool"
	default:
		if col.IsNullable {
			return "*string"
		}
		return "string"
	}
}

func nextMigrationNumber() (int, error) {
	root, err := repoRoot()
	if err != nil {
		return 0, err
	}
	entries, err := os.ReadDir(filepath.Join(root, "backend", "migrations"))
	if err != nil {
		return 0, err
	}
	maxN := 0
	for _, entry := range entries {
		name := entry.Name()
		if len(name) < 6 {
			continue
		}
		n, err := strconv.Atoi(name[:6])
		if err == nil && n > maxN {
			maxN = n
		}
	}
	return maxN + 1, nil
}

func repoRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if fileExists(filepath.Join(wd, "backend")) && fileExists(filepath.Join(wd, "frontend")) {
			return wd, nil
		}
		parent := filepath.Dir(wd)
		if parent == wd {
			return "", fmt.Errorf("repository root not found")
		}
		wd = parent
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

const generatedBackendTemplate = `package {{.Package}}

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
	group := g.Group("/{{.APIName}}", middleware.Auth(h.jwtSecret))
	group.GET("", h.List, middleware.RequireStaticPermission(h.db, "{{.Req.PermissionPrefix}}:view"))
	group.POST("", h.Create, middleware.RequireStaticPermission(h.db, "{{.Req.PermissionPrefix}}:create"))
	group.PUT("/:id", h.Update, middleware.RequireStaticPermission(h.db, "{{.Req.PermissionPrefix}}:update"))
	group.DELETE("/:id", h.Delete, middleware.RequireStaticPermission(h.db, "{{.Req.PermissionPrefix}}:delete"))
}

type Row struct {
{{- range .ListColumns }}
	{{ pascal .Name }} {{ goType . }} ` + "`json:\"{{ .Name }}\"`" + `
{{- end }}
}

func (h *Handler) List(c echo.Context) error {
	page, pageSize := response.PageParams(c, 10000)
	offset := (page - 1) * pageSize
	var total int64
	if err := h.db.QueryRow(c.Request().Context(), ` + "`" + `
SELECT count(*) FROM {{.Req.TableName}}{{ if .HasDeletedAt }} WHERE deleted_at IS NULL{{ end }}` + "`" + `).Scan(&total); err != nil {
		return err
	}
	rows, err := h.db.Query(c.Request().Context(), ` + "`" + `
SELECT {{ range $i, $c := .ListColumns }}{{ if $i }}, {{ end }}{{ $c.Name }}{{ end }}
FROM {{.Req.TableName}}
{{ if .HasDeletedAt }}WHERE deleted_at IS NULL{{ end }}
ORDER BY {{.PrimaryKey.Name}} DESC
LIMIT $1 OFFSET $2` + "`" + `, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan({{ range $i, $c := .ListColumns }}{{ if $i }}, {{ end }}&item.{{ pascal .Name }}{{ end }}); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return response.OK(c, response.Page[Row]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) Create(c echo.Context) error {
	var req Row
	if err := c.Bind(&req); err != nil {
		return err
	}
	var id int64
	if err := h.db.QueryRow(c.Request().Context(), ` + "`" + `
INSERT INTO {{.Req.TableName}} ({{ range $i, $c := .EditableColumns }}{{ if $i }}, {{ end }}{{ $c.Name }}{{ end }})
VALUES ({{ range $i, $c := .EditableColumns }}{{ if $i }}, {{ end }}${{ add $i 1 }}{{ end }})
RETURNING {{.PrimaryKey.Name}}` + "`" + `, {{ range $i, $c := .EditableColumns }}{{ if $i }}, {{ end }}req.{{ pascal .Name }}{{ end }}).Scan(&id); err != nil {
		return err
	}
	return response.Created(c, map[string]int64{"{{.PrimaryKey.Name}}": id})
}

func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var req Row
	if err := c.Bind(&req); err != nil {
		return err
	}
	tag, err := h.db.Exec(c.Request().Context(), ` + "`" + `
UPDATE {{.Req.TableName}}
SET {{ range $i, $c := .EditableColumns }}{{ if $i }}, {{ end }}{{ $c.Name }} = ${{ add $i 2 }}{{ end }}{{ if hasColumn .Req.Columns "updated_at" }}, updated_at = now(){{ end }}
WHERE {{.PrimaryKey.Name}} = $1{{ if .HasDeletedAt }} AND deleted_at IS NULL{{ end }}` + "`" + `, id, {{ range $i, $c := .EditableColumns }}{{ if $i }}, {{ end }}req.{{ pascal .Name }}{{ end }})
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "record not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	{{ if .HasDeletedAt }}tag, err := h.db.Exec(c.Request().Context(), ` + "`" + `UPDATE {{.Req.TableName}} SET deleted_at = now(){{ if hasColumn .Req.Columns "updated_at" }}, updated_at = now(){{ end }} WHERE {{.PrimaryKey.Name}} = $1 AND deleted_at IS NULL` + "`" + `, id){{ else }}return response.NewError(http.StatusBadRequest, "UNSUPPORTED_OPERATION", "delete requires deleted_at column"){{ end }}
	{{ if .HasDeletedAt }}if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "record not found")
	}
	return response.OK(c, map[string]bool{"deleted": true}){{ end }}
}
`

const generatedAPITemplate = `import { http } from '../request/http';

export type {{.TypeName}} = {
{{- range .ListColumns }}
  {{ .Name }}: {{ tsType . }}{{ if .IsNullable }} | null{{ end }};
{{- end }}
};

export type {{.FormName}} = Partial<{{.TypeName}}>;

export async function list{{.TypeName}}s(params?: { page?: number; page_size?: number }) {
  const res = await http.get<unknown, { data: { items: {{.TypeName}}[]; page: number; page_size: number; total: number } }>('/{{.APIName}}', { params });
  return res.data;
}

export async function create{{.TypeName}}(data: {{.FormName}}) {
  return http.post('/{{.APIName}}', data);
}

export async function update{{.TypeName}}(id: number, data: {{.FormName}}) {
  return http.put('/{{.APIName}}/' + id, data);
}

export async function delete{{.TypeName}}(id: number) {
  return http.delete('/{{.APIName}}/' + id);
}
`

const generatedPageTemplate = `import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormDigit, ProFormText, ProFormTextArea, ProTable, type ActionType } from '@ant-design/pro-components';
import { App, Button, Space } from 'antd';
import { useRef, useState } from 'react';
import { Permission } from '../../../components/Permission';
import { message } from '../../../utils/message';
import { operationColumnProps } from '../../../utils/tableColumns';
import { create{{.TypeName}}, delete{{.TypeName}}, list{{.TypeName}}s, update{{.TypeName}}, type {{.FormName}}, type {{.TypeName}} } from '../../../api/{{.APIName}}';

export function {{.PageName}}() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{{.TypeName}} | null>(null);

  const columns: ProColumns<{{.TypeName}}>[] = [
{{- range .ListColumns }}
    { title: '{{ .Name }}', dataIndex: '{{ .Name }}', search: false, width: 150 },
{{- end }}
    {
      title: '操作',
      ...operationColumnProps<{{.TypeName}}>(160),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="{{.Req.PermissionPrefix}}:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); setOpen(true); }}>编辑</Button>
          </Permission>
          <Permission code="{{.Req.PermissionPrefix}}:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>删除</Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function confirmDelete(row: {{.TypeName}}) {
    modal.confirm({
      title: '确认删除记录?',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await delete{{.TypeName}}(Number(row.{{.PrimaryKey.Name}}));
        message.success('记录已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: {{.FormName}}) {
    if (editing) {
      await update{{.TypeName}}(Number(editing.{{.PrimaryKey.Name}}), values);
      message.success('记录已更新');
    } else {
      await create{{.TypeName}}(values);
      message.success('记录已创建');
    }
    setOpen(false);
    setEditing(null);
    actionRef.current?.reload();
    return true;
  }

  return (
    <div style={{"{{"}} padding: '0 0 24px' {{"}}"}}>
      <ProTable<{{.TypeName}}>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{"{{"}} x: 'max-content' {{"}}"}}}
        request={async (params) => {
          const data = await list{{.TypeName}}s({ page: params.current, page_size: params.pageSize });
          return { data: data.items, total: data.total, success: true };
        }}
        pagination={{"{{"}} defaultPageSize: 10, showSizeChanger: false {{"}}"}}}
        toolBarRender={() => [
          <Permission code="{{.Req.PermissionPrefix}}:create" key="create">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增</Button>
          </Permission>,
        ]}
      />

      <ModalForm<{{.FormName}}>
        title={editing ? '编辑{{.Req.FeatureName}}' : '新增{{.Req.FeatureName}}'}
        open={open}
        modalProps={{"{{"}} destroyOnHidden: true, onCancel: () => { setOpen(false); setEditing(null); } {{"}}"}}}
        initialValues={editing ?? {}}
        onFinish={submit}
      >
{{- range .EditableColumns }}
        <{{ formElement . }} name="{{ .Name }}" label="{{ .Name }}"{{ if and (not .IsNullable) (not .HasDefault) }} rules={[{ required: true }]}{{ end }} />
{{- end }}
      </ModalForm>
    </div>
  );
}
`

const generatedMenuUpTemplate = `WITH business AS (
    SELECT id FROM sys_menus WHERE code = 'business' AND deleted_at IS NULL
),
page_menu AS (
    INSERT INTO sys_menus (parent_id, type, code, name, path, component, icon, sort_order)
    SELECT business.id, 'page', '{{.Req.PermissionPrefix}}:view', '{{.Req.FeatureName}}', '{{.Req.RoutePath}}', '{{.PageName}}', '{{.Req.MenuIcon}}', 29
    FROM business
    ON CONFLICT (code) DO UPDATE
    SET parent_id = EXCLUDED.parent_id,
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        path = EXCLUDED.path,
        component = EXCLUDED.component,
        icon = EXCLUDED.icon,
        sort_order = EXCLUDED.sort_order,
        deleted_at = NULL,
        updated_at = now()
    RETURNING id
),
button_menus AS (
    SELECT '{{.Req.PermissionPrefix}}:view' AS parent_code, 'button' AS type, '{{.Req.PermissionPrefix}}:create' AS code, '创建{{.Req.FeatureName}}' AS name, 291 AS sort_order
    UNION ALL SELECT '{{.Req.PermissionPrefix}}:view', 'button', '{{.Req.PermissionPrefix}}:update', '编辑{{.Req.FeatureName}}', 292
    UNION ALL SELECT '{{.Req.PermissionPrefix}}:view', 'button', '{{.Req.PermissionPrefix}}:delete', '删除{{.Req.FeatureName}}', 293
)
INSERT INTO sys_menus (parent_id, type, code, name, sort_order)
SELECT page_menu.id, button_menus.type, button_menus.code, button_menus.name, button_menus.sort_order
FROM button_menus
CROSS JOIN page_menu
ON CONFLICT (code) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    type = EXCLUDED.type,
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    deleted_at = NULL,
    updated_at = now();

INSERT INTO sys_role_menus (role_id, menu_id, data_scope)
SELECT r.id, m.id, 'ALL'
FROM sys_roles r
CROSS JOIN sys_menus m
WHERE r.code = 'ADMIN'
  AND m.code IN ('{{.Req.PermissionPrefix}}:view', '{{.Req.PermissionPrefix}}:create', '{{.Req.PermissionPrefix}}:update', '{{.Req.PermissionPrefix}}:delete')
ON CONFLICT DO NOTHING;
`

const generatedMenuDownTemplate = `DELETE FROM sys_role_menus
WHERE menu_id IN (
    SELECT id FROM sys_menus WHERE code IN ('{{.Req.PermissionPrefix}}:view', '{{.Req.PermissionPrefix}}:create', '{{.Req.PermissionPrefix}}:update', '{{.Req.PermissionPrefix}}:delete')
);

DELETE FROM sys_menus
WHERE code IN ('{{.Req.PermissionPrefix}}:create', '{{.Req.PermissionPrefix}}:update', '{{.Req.PermissionPrefix}}:delete', '{{.Req.PermissionPrefix}}:view');
`

const generatedIntegrationTemplate = `# {{.Req.FeatureName}} 集成说明

生成文件已包含后端模块、前端 API、前端页面和菜单迁移。为了让页面实际可访问，还需要手动接入现有共享入口。

## 后端注册

在 ` + "`backend/internal/http/server.go`" + ` 中添加模块 import：

` + "```go" + `
"enterprise-demo/backend/internal/modules/{{.Package}}"
` + "```" + `

在 API 注册区添加：

` + "```go" + `
{{.Package}}.NewHandler(db, cfg.JWTSecret).Register(api)
` + "```" + `

## 前端路由

在 ` + "`frontend/src/routes/lazyRoutes.ts`" + ` 的 ` + "`enterpriseRoutes`" + ` 中添加：

` + "```ts" + `
{ path: '{{.FrontendRoute}}', permission: '{{.Req.PermissionPrefix}}:view', loader: page(() => import('../features/{{.Package}}/pages/{{.PageName}}'), '{{.PageName}}') },
` + "```" + `

## 启用

1. 执行生成的菜单迁移。
2. 重启开发服务。
3. 运行 ` + "`cd backend && go test ./...`" + ` 和 ` + "`cd frontend && npm run build`" + `。
`
