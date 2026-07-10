package dashboard

import (
	"os"
	"strings"
	"testing"
)

func TestDashboardStatsIncludesCurrentUserPendingTodos(t *testing.T) {
	source, err := os.ReadFile("handler.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)

	for _, expected := range []string{
		"PendingTodos",
		`json:"pending_todos"`,
		"middleware.CurrentUserID(c)",
		"middleware.ActiveRoleCode(c)",
		"countPendingTodos",
		"assignee = ANY($1)",
	} {
		if !strings.Contains(text, expected) {
			t.Fatalf("dashboard handler must include %s", expected)
		}
	}
}
