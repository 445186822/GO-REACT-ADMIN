package customer

import (
	"strings"
)

type ImportFailure struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

type ImportResult struct {
	Total   int             `json:"total"`
	Success int             `json:"success"`
	Failed  int             `json:"failed"`
	Errors  []ImportFailure `json:"errors"`
}

func customerImportTemplateRows() [][]string {
	return [][]string{
		{"客户名称", "级别", "手机", "邮箱", "状态", "备注"},
		{"上海示例科技有限公司", "重点客户", "13800138000", "contact@example.com", "有效", "模板示例：重点客户"},
		{"杭州未来制造有限公司", "普通客户", "13900139000", "sales@example.com", "有效", "模板示例：普通客户"},
		{"深圳潜在合作方", "潜在客户", "13700137000", "lead@example.com", "停用", "模板示例：潜在客户"},
	}
}

func parseCustomerImportRows(rows [][]string) ([]Row, []ImportFailure) {
	if len(rows) < 2 {
		return nil, []ImportFailure{{Row: 1, Reason: "Excel 至少需要表头和一行数据"}}
	}
	headers := headerIndexes(rows[0])
	nameIndex, ok := headers["客户名称"]
	if !ok {
		nameIndex, ok = headers["name"]
	}
	if !ok {
		return nil, []ImportFailure{{Row: 1, Reason: "缺少客户名称表头"}}
	}

	customers := make([]Row, 0, len(rows)-1)
	failures := make([]ImportFailure, 0)
	for rowIndex, row := range rows[1:] {
		excelRow := rowIndex + 2
		if rowIsBlank(row) {
			continue
		}
		name := cellAt(row, nameIndex)
		if name == "" {
			failures = append(failures, ImportFailure{Row: excelRow, Reason: "客户名称不能为空"})
			continue
		}
		level, err := normalizeLevel(cellByHeader(row, headers, "级别", "level"))
		if err != "" {
			failures = append(failures, ImportFailure{Row: excelRow, Reason: err})
			continue
		}
		status, err := normalizeStatus(cellByHeader(row, headers, "状态", "status"))
		if err != "" {
			failures = append(failures, ImportFailure{Row: excelRow, Reason: err})
			continue
		}
		customers = append(customers, Row{
			Name:   name,
			Level:  level,
			Phone:  stringPtr(cellByHeader(row, headers, "手机", "phone")),
			Email:  stringPtr(cellByHeader(row, headers, "邮箱", "email")),
			Status: status,
			Remark: stringPtr(cellByHeader(row, headers, "备注", "remark")),
		})
	}
	return customers, failures
}

func headerIndexes(row []string) map[string]int {
	indexes := make(map[string]int, len(row))
	for index, value := range row {
		key := strings.ToLower(strings.TrimSpace(value))
		if key != "" {
			indexes[key] = index
		}
	}
	return indexes
}

func cellByHeader(row []string, headers map[string]int, names ...string) string {
	for _, name := range names {
		if index, ok := headers[strings.ToLower(name)]; ok {
			return cellAt(row, index)
		}
	}
	return ""
}

func cellAt(row []string, index int) string {
	if index < 0 || index >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[index])
}

func rowIsBlank(row []string) bool {
	for _, value := range row {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func normalizeLevel(value string) (string, string) {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "", "NORMAL", "普通客户":
		return "NORMAL", ""
	case "IMPORTANT", "重点客户":
		return "IMPORTANT", ""
	case "POTENTIAL", "潜在客户":
		return "POTENTIAL", ""
	default:
		return "", "级别必须是重点客户、普通客户、潜在客户或对应枚举值"
	}
}

func normalizeStatus(value string) (string, string) {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "", "ACTIVE", "有效":
		return "ACTIVE", ""
	case "DISABLED", "停用":
		return "DISABLED", ""
	default:
		return "", "状态必须是有效、停用或对应枚举值"
	}
}

func stringPtr(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	return &trimmed
}
