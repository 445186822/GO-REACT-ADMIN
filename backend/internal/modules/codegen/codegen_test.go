package codegen

import (
	"strings"
	"testing"
)

func TestIsAllowedBusinessTable(t *testing.T) {
	if !isAllowedBusinessTable("biz_customers") {
		t.Fatal("expected biz_customers to be allowed")
	}
	disallowed := []string{"sys_users", "biz_Customers", "biz_customers;drop", "audit_logs", "biz-foo", ""}
	for _, table := range disallowed {
		if isAllowedBusinessTable(table) {
			t.Fatalf("expected %q to be rejected", table)
		}
	}
}

func TestNormalizeModuleName(t *testing.T) {
	got, err := normalizeModuleName("contract_item")
	if err != nil {
		t.Fatalf("normalizeModuleName() error = %v", err)
	}
	if got != "contractitem" {
		t.Fatalf("normalizeModuleName() = %q, want contractitem", got)
	}
	if _, err := normalizeModuleName("sys_user"); err == nil {
		t.Fatal("expected reserved module name to be rejected")
	}
}

func TestColumnTypeMapping(t *testing.T) {
	tests := []struct {
		dataType string
		tsType   string
		formType string
	}{
		{"text", "string", "text"},
		{"integer", "number", "number"},
		{"numeric", "number", "number"},
		{"boolean", "boolean", "switch"},
		{"date", "string", "date"},
		{"timestamp with time zone", "string", "datetime"},
		{"jsonb", "unknown", "textarea"},
	}

	for _, tt := range tests {
		got := mapColumnType(tt.dataType)
		if got.TypeScriptType != tt.tsType || got.FormType != tt.formType {
			t.Fatalf("mapColumnType(%q) = %#v, want ts=%q form=%q", tt.dataType, got, tt.tsType, tt.formType)
		}
	}
}

func TestBuildPreviewIncludesExpectedFiles(t *testing.T) {
	req := GenerateRequest{
		TableName:        "biz_contracts",
		FeatureName:      "合同管理",
		ModuleName:       "contract",
		RoutePath:        "/business/contracts",
		PermissionPrefix: "contract",
		MenuIcon:         "CodeOutlined",
		Columns: []ColumnMeta{
			{Name: "id", DataType: "bigint", IsPrimaryKey: true},
			{Name: "name", DataType: "text", IsNullable: false},
			{Name: "amount", DataType: "numeric", IsNullable: true},
			{Name: "deleted_at", DataType: "timestamp with time zone", IsNullable: true},
		},
	}

	files, err := buildPreview(req, 27)
	if err != nil {
		t.Fatalf("buildPreview() error = %v", err)
	}
	expected := []string{
		"backend/internal/modules/contract/handler.go",
		"frontend/src/api/contracts.ts",
		"frontend/src/features/contract/pages/ContractListPage.tsx",
		"backend/migrations/000027_contract_menu.up.sql",
		"backend/migrations/000027_contract_menu.down.sql",
		"docs/generated/contract_integration.md",
	}
	for _, path := range expected {
		if !previewHasPath(files, path) {
			t.Fatalf("expected preview to include %s; got %#v", path, files)
		}
	}
	backend := previewContent(files, "backend/internal/modules/contract/handler.go")
	if !strings.Contains(backend, "Amount *float64") {
		t.Fatalf("expected nullable numeric column to generate pointer type; backend content:\n%s", backend)
	}
	if !strings.Contains(backend, "middleware.RequireStaticPermission(h.db, \"contract:view\")") {
		t.Fatalf("expected generated backend to use static permissions; backend content:\n%s", backend)
	}
	page := previewContent(files, "frontend/src/features/contract/pages/ContractListPage.tsx")
	if !strings.Contains(page, "ProFormDigit") {
		t.Fatalf("expected generated page to import numeric form control; page content:\n%s", page)
	}
	notes := previewContent(files, "docs/generated/contract_integration.md")
	if !strings.Contains(notes, "contract.NewHandler(db, cfg.JWTSecret).Register(api)") {
		t.Fatalf("expected integration notes to include backend registration; notes:\n%s", notes)
	}
	if !strings.Contains(notes, "business/contracts") {
		t.Fatalf("expected integration notes to include frontend route; notes:\n%s", notes)
	}
}

func TestBuildPreviewUsesPrimaryKeyColumn(t *testing.T) {
	req := GenerateRequest{
		TableName:        "biz_messages",
		FeatureName:      "消息管理",
		ModuleName:       "message",
		RoutePath:        "/business/messages",
		PermissionPrefix: "message",
		MenuIcon:         "CodeOutlined",
		Columns: []ColumnMeta{
			{Name: "record_id", DataType: "bigint", IsPrimaryKey: true},
			{Name: "title", DataType: "text", IsNullable: false},
		},
	}

	files, err := buildPreview(req, 28)
	if err != nil {
		t.Fatalf("buildPreview() error = %v", err)
	}
	backend := previewContent(files, "backend/internal/modules/message/handler.go")
	expectedBackend := []string{"RETURNING record_id", "ORDER BY record_id DESC", "WHERE record_id = $1"}
	for _, text := range expectedBackend {
		if !strings.Contains(backend, text) {
			t.Fatalf("expected generated backend to contain %q; backend content:\n%s", text, backend)
		}
	}
	page := previewContent(files, "frontend/src/features/message/pages/MessageListPage.tsx")
	if !strings.Contains(page, "Number(row.record_id)") {
		t.Fatalf("expected generated page to use primary key column; page content:\n%s", page)
	}
}

func TestBuildPreviewRejectsUnsupportedPrimaryKey(t *testing.T) {
	req := GenerateRequest{
		TableName:        "biz_documents",
		FeatureName:      "文档管理",
		ModuleName:       "document",
		RoutePath:        "/business/documents",
		PermissionPrefix: "document",
		MenuIcon:         "CodeOutlined",
		Columns: []ColumnMeta{
			{Name: "document_id", DataType: "uuid", IsPrimaryKey: true},
			{Name: "title", DataType: "text", IsNullable: false},
		},
	}

	if _, err := buildPreview(req, 28); err == nil {
		t.Fatal("expected unsupported primary key to be rejected")
	}
}

func previewHasPath(files []GeneratedFile, path string) bool {
	for _, file := range files {
		if file.Path == path {
			return true
		}
	}
	return false
}

func previewContent(files []GeneratedFile, path string) string {
	for _, file := range files {
		if file.Path == path {
			return file.Content
		}
	}
	return ""
}
