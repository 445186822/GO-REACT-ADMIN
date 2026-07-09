package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"enterprise-demo/backend/internal/auth"

	"github.com/labstack/echo/v4"
)

func TestAuthStoresCurrentUserFromClaims(t *testing.T) {
	const secret = "test-secret"
	token, err := auth.Sign(secret, 42, "alice", time.Hour)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/users", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	req.Header.Set(ActiveRoleHeader, "dept_manager")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	called := false
	err = Auth(secret)(func(c echo.Context) error {
		called = true
		if got := CurrentUserID(c); got != 42 {
			t.Fatalf("CurrentUserID() = %d, want 42", got)
		}
		if got := CurrentUsername(c); got != "alice" {
			t.Fatalf("CurrentUsername() = %q, want alice", got)
		}
		if got := ActiveRoleCode(c); got != "dept_manager" {
			t.Fatalf("ActiveRoleCode() = %q, want dept_manager", got)
		}
		return nil
	})(c)
	if err != nil {
		t.Fatalf("Auth() error = %v", err)
	}
	if !called {
		t.Fatal("expected next handler to be called")
	}
}
