package customer

import (
	"testing"

	"enterprise-demo/backend/internal/exportxlsx"
	"enterprise-demo/backend/internal/importxlsx"
)

func TestParseCustomerImportRowsMapsExportedHeaders(t *testing.T) {
	rows := [][]string{
		{"ID", "客户名称", "级别", "手机", "邮箱", "负责人", "部门", "状态", "备注"},
		{"1", "上海示例科技", "重点客户", "13800138000", "sales@example.com", "管理员", "研发部", "有效", "首批导入"},
	}

	customers, failures := parseCustomerImportRows(rows)

	if len(failures) != 0 {
		t.Fatalf("failures = %#v, want none", failures)
	}
	if len(customers) != 1 {
		t.Fatalf("len(customers) = %d, want 1", len(customers))
	}
	got := customers[0]
	if got.Name != "上海示例科技" || got.Level != "IMPORTANT" || got.Status != "ACTIVE" {
		t.Fatalf("customer = %#v, want normalized customer values", got)
	}
	if stringValue(got.Phone) != "13800138000" || stringValue(got.Email) != "sales@example.com" || stringValue(got.Remark) != "首批导入" {
		t.Fatalf("customer optional fields = %#v", got)
	}
}

func TestParseCustomerImportRowsReturnsRowFailures(t *testing.T) {
	rows := [][]string{
		{"客户名称", "级别", "状态"},
		{"", "普通客户", "有效"},
		{"测试客户", "未知级别", "有效"},
		{"正常客户", "潜在客户", "停用"},
	}

	customers, failures := parseCustomerImportRows(rows)

	if len(customers) != 1 {
		t.Fatalf("len(customers) = %d, want 1", len(customers))
	}
	if customers[0].Level != "POTENTIAL" || customers[0].Status != "DISABLED" {
		t.Fatalf("customers[0] = %#v, want normalized potential disabled customer", customers[0])
	}
	if len(failures) != 2 {
		t.Fatalf("len(failures) = %d, want 2", len(failures))
	}
	if failures[0].Row != 2 || failures[0].Reason == "" {
		t.Fatalf("failures[0] = %#v, want missing name failure on row 2", failures[0])
	}
	if failures[1].Row != 3 || failures[1].Reason == "" {
		t.Fatalf("failures[1] = %#v, want invalid level failure on row 3", failures[1])
	}
}

func TestCustomerImportTemplateCanBeReadAndParsed(t *testing.T) {
	content, err := exportxlsx.Build("Customers", customerImportTemplateRows())
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	rows, err := importxlsx.Read(content)
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	customers, failures := parseCustomerImportRows(rows)
	if len(failures) != 0 {
		t.Fatalf("failures = %#v, want none", failures)
	}
	if len(customers) != 3 {
		t.Fatalf("len(customers) = %d, want 3", len(customers))
	}
	if customers[0].Name != "上海示例科技有限公司" || customers[2].Status != "DISABLED" {
		t.Fatalf("customers = %#v, want parsed sample rows", customers)
	}
}
