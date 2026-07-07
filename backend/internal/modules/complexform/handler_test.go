package complexform

import "testing"

func TestNormalizeFormDefaultsAndTrimsValues(t *testing.T) {
	form := Form{
		Title:         "  新供应商准入  ",
		Applicant:     "  张三  ",
		Department:    "  采购部  ",
		Category:      "",
		Priority:      "",
		Status:        "",
		ContactName:   stringPtr("  李四  "),
		ContactPhone:  stringPtr("  13800138000  "),
		ContactEmail:  stringPtr("  buyer@example.com  "),
		AttachmentURL: stringPtr("  https://example.com/file.pdf  "),
		Remark:        stringPtr("  备注  "),
	}

	normalizeForm(&form)

	if form.Title != "新供应商准入" || form.Applicant != "张三" || form.Department != "采购部" {
		t.Fatalf("basic text fields were not trimmed: %#v", form)
	}
	if form.Category != "PROCUREMENT" || form.Priority != "MEDIUM" || form.Status != "DRAFT" {
		t.Fatalf("defaults = category %q priority %q status %q", form.Category, form.Priority, form.Status)
	}
	if form.ContactName == nil || *form.ContactName != "李四" {
		t.Fatalf("contact_name = %#v, want trimmed value", form.ContactName)
	}
	if form.AttachmentURL == nil || *form.AttachmentURL != "https://example.com/file.pdf" {
		t.Fatalf("attachment_url = %#v, want trimmed value", form.AttachmentURL)
	}
	if form.Remark == nil || *form.Remark != "备注" {
		t.Fatalf("remark = %#v, want trimmed value", form.Remark)
	}
}

func TestNormalizeFormClearsBlankPointers(t *testing.T) {
	blank := "   "
	form := Form{Title: "标题", Applicant: "申请人", Department: "部门", ContactName: &blank, Remark: &blank}

	normalizeForm(&form)

	if form.ContactName != nil || form.Remark != nil {
		t.Fatalf("blank pointer fields should become nil: %#v", form)
	}
}

func stringPtr(value string) *string {
	return &value
}
