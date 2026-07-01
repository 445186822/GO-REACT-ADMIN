package authmodule

import "testing"

func TestSelectActiveRoleUsesRequestedOwnedRole(t *testing.T) {
	roles := []RoleBrief{
		{ID: 1, Code: "ADMIN", Name: "System Administrator"},
		{ID: 2, Code: "DEPT_MANAGER", Name: "部门负责人"},
	}

	role := selectActiveRole(roles, "dept_manager")
	if role == nil || role.ID != 2 {
		t.Fatalf("expected DEPT_MANAGER role, got %#v", role)
	}
}

func TestSelectActiveRoleFallsBackToFirstRole(t *testing.T) {
	roles := []RoleBrief{
		{ID: 1, Code: "ADMIN", Name: "System Administrator"},
		{ID: 2, Code: "DEPT_MANAGER", Name: "部门负责人"},
	}

	role := selectActiveRole(roles, "UNKNOWN")
	if role == nil || role.ID != 1 {
		t.Fatalf("expected first role fallback, got %#v", role)
	}
}
