package database

import "testing"

func TestValidateMigrationFilesRejectsNewDuplicateNumbers(t *testing.T) {
	err := validateMigrationFiles([]string{
		"migrations/000020_runtime.up.sql",
		"migrations/000020_other_feature.up.sql",
	})
	if err == nil {
		t.Fatal("validateMigrationFiles accepted duplicate migration numbers")
	}
}

func TestValidateMigrationFilesAllowsKnownLegacyDuplicateNumber(t *testing.T) {
	err := validateMigrationFiles([]string{
		"migrations/000019_chat_full.up.sql",
		"migrations/000019_scheduler_demo.up.sql",
	})
	if err != nil {
		t.Fatalf("validateMigrationFiles rejected legacy duplicate: %v", err)
	}
}

func TestValidateMigrationFilesRejectsMalformedNames(t *testing.T) {
	err := validateMigrationFiles([]string{
		"migrations/create_users.up.sql",
	})
	if err == nil {
		t.Fatal("validateMigrationFiles accepted migration without numeric prefix")
	}
}
