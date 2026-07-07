package file

import (
	"path/filepath"
	"testing"
)

func TestStoragePathForUsesOSPathRules(t *testing.T) {
	uploadDir := filepath.Join("tmp", "enterprise-uploads")
	storedName := "abc123.txt"

	got := storagePathFor(uploadDir, storedName)
	want := filepath.Join(uploadDir, storedName)

	if got != want {
		t.Fatalf("storagePathFor() = %q, want %q", got, want)
	}
}

func TestStoredFilenameKeepsOnlyOriginalExtension(t *testing.T) {
	got := storedFileNameFor("..\\nested/report.final.PDF", "random-token")

	if got != "random-token.PDF" {
		t.Fatalf("storedFileNameFor() = %q, want %q", got, "random-token.PDF")
	}
}
