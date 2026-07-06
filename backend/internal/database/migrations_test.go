package database

import (
	"strings"
	"testing"
)

func TestSeedMenusIncludesArchitecturePage(t *testing.T) {
	if !strings.Contains(seedMenusSQL, "'architecture:view'") {
		t.Fatal("seedMenusSQL must include architecture:view permission")
	}
	if !strings.Contains(seedMenusSQL, "'/system/architecture'") {
		t.Fatal("seedMenusSQL must include /system/architecture path")
	}
}

func TestSeedMenusGroupsMessagingAndProtocolExperienceMenus(t *testing.T) {
	required := []string{
		"(NULL, 'directory', 'messaging', '消息与协议'",
		"('messaging', 'page', 'chat:view', '即时通讯'",
		"('messaging', 'page', 'queue:kafka', 'Kafka体验'",
		"('messaging', 'page', 'queue:rabbitmq', 'RabbitMQ体验'",
		"('messaging', 'page', 'queue:tcp', 'TCP体验'",
		"('messaging', 'page', 'queue:udp', 'UDP体验'",
		"('messaging', 'page', 'queue:mqtt', 'MQTT体验'",
	}
	for _, text := range required {
		if !strings.Contains(seedMenusSQL, text) {
			t.Fatalf("seedMenusSQL must contain %q", text)
		}
	}
}

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
