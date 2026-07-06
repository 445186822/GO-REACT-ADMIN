package collaboration

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestAIToolAnswersCustomerCountWhenPermitted(t *testing.T) {
	q := &fakeAIToolQueryer{
		rows: []*fakeAIToolRow{
			{values: []any{true}},
			{values: []any{int64(12)}},
		},
	}

	answer, handled, err := tryAnswerAIDataQuestion(context.Background(), q, 7, "admin", "当前后台系统有多少个客户？")
	if err != nil {
		t.Fatalf("tryAnswerAIDataQuestion returned error: %v", err)
	}
	if !handled {
		t.Fatal("customer count question was not handled")
	}
	if !strings.Contains(answer, "当前后台系统客户数为 12 个") {
		t.Fatalf("answer = %q, want customer count", answer)
	}
	if len(q.queries) != 2 {
		t.Fatalf("query count = %d, want 2", len(q.queries))
	}
	if !strings.Contains(q.queries[1], "FROM biz_customers") {
		t.Fatalf("count query = %q, want biz_customers query", q.queries[1])
	}
}

func TestAIToolRefusesCustomerCountWithoutPermission(t *testing.T) {
	q := &fakeAIToolQueryer{rows: []*fakeAIToolRow{{values: []any{false}}}}

	answer, handled, err := tryAnswerAIDataQuestion(context.Background(), q, 7, "demo", "客户总数是多少？")
	if err != nil {
		t.Fatalf("tryAnswerAIDataQuestion returned error: %v", err)
	}
	if !handled {
		t.Fatal("customer count question was not handled")
	}
	if !strings.Contains(answer, "没有 customer:view 权限") {
		t.Fatalf("answer = %q, want permission explanation", answer)
	}
	if len(q.queries) != 1 {
		t.Fatalf("query count = %d, want only permission query", len(q.queries))
	}
}

func TestAIToolIgnoresGeneralChat(t *testing.T) {
	answer, handled, err := tryAnswerAIDataQuestion(context.Background(), &fakeAIToolQueryer{}, 7, "admin", "帮我写一段通知文案")
	if err != nil {
		t.Fatalf("tryAnswerAIDataQuestion returned error: %v", err)
	}
	if handled || answer != "" {
		t.Fatalf("answer = %q, handled = %v; want unhandled", answer, handled)
	}
}

func TestLatestUserAIMessage(t *testing.T) {
	got := latestUserAIMessage([]ChatMessage{
		{Role: "user", Content: "第一条问题"},
		{Role: "assistant", Content: "上一轮回答"},
		{Role: "user", Content: "当前后台系统有多少个客户？"},
	})
	if got != "当前后台系统有多少个客户？" {
		t.Fatalf("latestUserAIMessage() = %q", got)
	}
}

func TestAIToolAnswersCustomerDetailWhenSingleCustomerMatches(t *testing.T) {
	phone := "13800000000"
	email := "sales@example.com"
	remark := "重点跟进"
	q := &fakeAIToolQueryer{
		rows: []*fakeAIToolRow{
			{values: []any{true}},
			{values: []any{true, int64(0)}},
		},
		queryRows: []*fakeAIToolRows{
			{rows: [][]any{{
				int64(12),
				"星河科技",
				"IMPORTANT",
				&phone,
				&email,
				"管理员",
				"销售部",
				"ACTIVE",
				&remark,
				time.Date(2026, 7, 1, 9, 30, 0, 0, time.UTC),
				time.Date(2026, 7, 2, 10, 45, 0, 0, time.UTC),
			}}},
		},
	}

	answer, handled, err := tryAnswerAIDataQuestion(context.Background(), q, 7, "admin", "调出客户星河科技的所有资料")
	if err != nil {
		t.Fatalf("tryAnswerAIDataQuestion returned error: %v", err)
	}
	if !handled {
		t.Fatal("customer detail question was not handled")
	}
	for _, want := range []string{"客户ID：12", "客户名称：星河科技", "客户级别：重点客户", "手机：13800000000", "邮箱：sales@example.com", "负责人：管理员", "部门：销售部", "备注：重点跟进"} {
		if !strings.Contains(answer, want) {
			t.Fatalf("answer = %q, want %q", answer, want)
		}
	}
	if len(q.queries) != 3 {
		t.Fatalf("query count = %d, want permission, scope and detail queries", len(q.queries))
	}
	if !strings.Contains(q.queries[2], "FROM biz_customers") {
		t.Fatalf("detail query = %q, want biz_customers query", q.queries[2])
	}
}

func TestAIToolAsksForCustomerIDWhenMultipleCustomersMatch(t *testing.T) {
	q := &fakeAIToolQueryer{
		rows: []*fakeAIToolRow{
			{values: []any{true}},
			{values: []any{true, int64(0)}},
		},
		queryRows: []*fakeAIToolRows{
			{rows: [][]any{
				{int64(12), "星河科技北京", "IMPORTANT", nil, nil, "管理员", "销售部", "ACTIVE", nil, time.Time{}, time.Time{}},
				{int64(13), "星河科技上海", "NORMAL", nil, nil, "管理员", "销售部", "ACTIVE", nil, time.Time{}, time.Time{}},
			}},
		},
	}

	answer, handled, err := tryAnswerAIDataQuestion(context.Background(), q, 7, "admin", "查询客户星河科技的详情")
	if err != nil {
		t.Fatalf("tryAnswerAIDataQuestion returned error: %v", err)
	}
	if !handled {
		t.Fatal("customer detail question was not handled")
	}
	for _, want := range []string{"匹配到多个客户", "ID 12：星河科技北京", "ID 13：星河科技上海", "请继续指定客户ID"} {
		if !strings.Contains(answer, want) {
			t.Fatalf("answer = %q, want %q", answer, want)
		}
	}
}

type fakeAIToolQueryer struct {
	rows      []*fakeAIToolRow
	queryRows []*fakeAIToolRows
	queries   []string
	args      [][]any
}

func (q *fakeAIToolQueryer) QueryRow(ctx context.Context, sql string, args ...any) aiToolRow {
	q.queries = append(q.queries, sql)
	q.args = append(q.args, args)
	if len(q.rows) == 0 {
		return &fakeAIToolRow{err: context.Canceled}
	}
	row := q.rows[0]
	q.rows = q.rows[1:]
	return row
}

func (q *fakeAIToolQueryer) Query(ctx context.Context, sql string, args ...any) (aiToolRows, error) {
	q.queries = append(q.queries, sql)
	q.args = append(q.args, args)
	if len(q.queryRows) == 0 {
		return &fakeAIToolRows{err: context.Canceled}, nil
	}
	rows := q.queryRows[0]
	q.queryRows = q.queryRows[1:]
	return rows, nil
}

type fakeAIToolRow struct {
	values []any
	err    error
}

func (r *fakeAIToolRow) Scan(dest ...any) error {
	return scanFakeAIValues(r.values, r.err, dest...)
}

type fakeAIToolRows struct {
	rows    [][]any
	index   int
	err     error
	scanErr error
}

func (r *fakeAIToolRows) Close() {}

func (r *fakeAIToolRows) Next() bool {
	if r.index >= len(r.rows) {
		return false
	}
	r.index++
	return true
}

func (r *fakeAIToolRows) Scan(dest ...any) error {
	if r.index == 0 || r.index > len(r.rows) {
		return context.Canceled
	}
	return scanFakeAIValues(r.rows[r.index-1], r.scanErr, dest...)
}

func (r *fakeAIToolRows) Err() error {
	return r.err
}

func scanFakeAIValues(values []any, err error, dest ...any) error {
	if err != nil {
		return err
	}
	for i, value := range values {
		switch target := dest[i].(type) {
		case *bool:
			*target = value.(bool)
		case *int64:
			*target = value.(int64)
		case *string:
			*target = value.(string)
		case **string:
			if value == nil {
				*target = nil
			} else {
				*target = value.(*string)
			}
		case *time.Time:
			*target = value.(time.Time)
		}
	}
	return nil
}
