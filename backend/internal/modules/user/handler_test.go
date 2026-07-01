package user

import "testing"

func TestNormalizeRoleIDsDeduplicatesAndKeepsOrder(t *testing.T) {
	roleIDs := normalizeRoleIDs([]int64{2, 0, 3, 2, -1}, nil)

	if len(roleIDs) != 2 || roleIDs[0] != 2 || roleIDs[1] != 3 {
		t.Fatalf("unexpected normalized role ids: %#v", roleIDs)
	}
}

func TestNormalizeRoleIDsFallsBackToLegacyRoleID(t *testing.T) {
	legacyRoleID := int64(5)
	roleIDs := normalizeRoleIDs(nil, &legacyRoleID)

	if len(roleIDs) != 1 || roleIDs[0] != 5 {
		t.Fatalf("expected legacy role id fallback, got %#v", roleIDs)
	}
}
