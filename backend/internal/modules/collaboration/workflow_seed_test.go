package collaboration

import (
	"os"
	"strings"
	"testing"
)

func TestAmountApprovalSeedDoesNotGrantGeneralManagerToAdmin(t *testing.T) {
	data, err := os.ReadFile("../../../migrations/000021_amount_approval_test_workflow.up.sql")
	if err != nil {
		t.Fatalf("read amount approval migration: %v", err)
	}
	content := string(data)

	if strings.Contains(content, "WHERE u.username IN ('admin', 'general_manager')") {
		t.Fatal("amount approval seed must not grant GENERAL_MANAGER to admin; use general_manager account for that approval branch")
	}
}
