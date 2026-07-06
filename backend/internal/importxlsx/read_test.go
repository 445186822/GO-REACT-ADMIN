package importxlsx

import (
	"testing"

	"enterprise-demo/backend/internal/exportxlsx"
)

func TestReadReturnsRowsFromInlineStringWorkbook(t *testing.T) {
	content, err := exportxlsx.Build("Customers", [][]string{
		{"客户名称", "级别", "状态"},
		{"上海示例科技", "重点客户", "有效"},
	})
	if err != nil {
		t.Fatal(err)
	}

	rows, err := Read(content)
	if err != nil {
		t.Fatalf("Read returned error: %v", err)
	}

	if len(rows) != 2 {
		t.Fatalf("len(rows) = %d, want 2", len(rows))
	}
	if rows[1][0] != "上海示例科技" || rows[1][1] != "重点客户" || rows[1][2] != "有效" {
		t.Fatalf("rows[1] = %#v, want imported customer row", rows[1])
	}
}
