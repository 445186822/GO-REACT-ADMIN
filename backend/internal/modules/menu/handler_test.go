package menu

import "testing"

func TestNormalizeMenuFormDefaultsAndTrimsValues(t *testing.T) {
	path := " /system/demo "
	icon := " DemoOutlined "
	form := Form{
		Type: " PAGE ",
		Code: " demo:view ",
		Name: " 演示菜单 ",
		Path: &path,
		Icon: &icon,
	}

	if err := normalizeMenuForm(&form); err != nil {
		t.Fatalf("normalizeMenuForm() error = %v", err)
	}
	if form.Type != "page" || form.Code != "demo:view" || form.Name != "演示菜单" {
		t.Fatalf("form = %#v, want trimmed type/code/name", form)
	}
	if form.Path == nil || *form.Path != "/system/demo" {
		t.Fatalf("path = %#v, want trimmed path", form.Path)
	}
	if form.Icon == nil || *form.Icon != "DemoOutlined" {
		t.Fatalf("icon = %#v, want trimmed icon", form.Icon)
	}
}

func TestNormalizeMenuFormRejectsInvalidType(t *testing.T) {
	form := Form{Type: "link", Code: "demo:view", Name: "演示菜单"}

	if err := normalizeMenuForm(&form); err == nil {
		t.Fatal("normalizeMenuForm() error = nil, want invalid type error")
	}
}
