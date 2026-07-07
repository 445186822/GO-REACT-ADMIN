package middleware

import (
	"net/http"
	"testing"
)

func TestPermissionForMenuRequests(t *testing.T) {
	cases := []struct {
		method string
		path   string
		want   string
	}{
		{http.MethodGet, "/api/v1/menus", "menu:view"},
		{http.MethodPost, "/api/v1/menus", "menu:create"},
		{http.MethodPut, "/api/v1/menus/12", "menu:update"},
		{http.MethodDelete, "/api/v1/menus/12", "menu:delete"},
	}

	for _, tc := range cases {
		if got := PermissionForRequest(tc.method, tc.path); got != tc.want {
			t.Fatalf("PermissionForRequest(%s, %s) = %q, want %q", tc.method, tc.path, got, tc.want)
		}
	}
}

func TestPermissionForCustomerImportTemplate(t *testing.T) {
	if got := PermissionForRequest(http.MethodGet, "/api/v1/customers/import-template"); got != "customer:create" {
		t.Fatalf("PermissionForRequest() = %q, want customer:create", got)
	}
}

func TestPermissionForComplexFormRequests(t *testing.T) {
	cases := []struct {
		method string
		path   string
		want   string
	}{
		{http.MethodGet, "/api/v1/complex-forms", "complex-form:view"},
		{http.MethodPost, "/api/v1/complex-forms", "complex-form:create"},
		{http.MethodPut, "/api/v1/complex-forms/12", "complex-form:update"},
		{http.MethodDelete, "/api/v1/complex-forms/12", "complex-form:delete"},
	}

	for _, tc := range cases {
		if got := PermissionForRequest(tc.method, tc.path); got != tc.want {
			t.Fatalf("PermissionForRequest(%s, %s) = %q, want %q", tc.method, tc.path, got, tc.want)
		}
	}
}
