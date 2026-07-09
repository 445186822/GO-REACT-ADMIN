package announcement

import (
	"os"
	"strings"
	"testing"
)

func TestReadStatusDoesNotHideRowsBehindRecipientGate(t *testing.T) {
	source, err := os.ReadFile("handler.go")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(source), "a.created_by = $2 OR ar.user_id = $2") {
		t.Fatal("read-status should rely on route permission instead of hiding data behind creator/recipient gate")
	}
}

func TestReadStatusDoesNotSelectMissingUserAvatarColumn(t *testing.T) {
	source, err := os.ReadFile("handler.go")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(source), "u.avatar") {
		t.Fatal("sys_users has no avatar column; read-status should return a typed null avatar placeholder")
	}
}
