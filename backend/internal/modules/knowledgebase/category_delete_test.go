package knowledgebase

import (
	"net/http"
	"testing"

	"enterprise-demo/backend/internal/http/response"
)

func TestCategoryDeleteBlockerRejectsReferencedCategory(t *testing.T) {
	err := categoryDeleteBlocker(categoryUsageCounts{Children: 1, Articles: 2, FAQs: 3})
	if err == nil {
		t.Fatal("categoryDeleteBlocker returned nil, want conflict error")
	}
	appErr, ok := err.(*response.AppError)
	if !ok {
		t.Fatalf("categoryDeleteBlocker returned %T, want *response.AppError", err)
	}
	if appErr.HTTPStatus != http.StatusConflict || appErr.Code != "KB_CATEGORY_IN_USE" {
		t.Fatalf("error = (%d, %s), want conflict KB_CATEGORY_IN_USE", appErr.HTTPStatus, appErr.Code)
	}
}

func TestCategoryDeleteBlockerAllowsUnusedCategory(t *testing.T) {
	if err := categoryDeleteBlocker(categoryUsageCounts{}); err != nil {
		t.Fatalf("categoryDeleteBlocker returned %v, want nil", err)
	}
}
