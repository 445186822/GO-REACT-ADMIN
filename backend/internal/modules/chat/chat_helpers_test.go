package chat

import (
	"testing"
	"time"
)

func TestBuildParticipantIDsDeduplicatesAndKeepsCurrentUserFirst(t *testing.T) {
	got := buildParticipantIDs(7, []int64{8, 7, 9, 8})
	want := []int64{7, 8, 9}

	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got[%d] = %d, want %d", i, got[i], want[i])
		}
	}
}

func TestBuildSessionTitleUsesOtherParticipantNames(t *testing.T) {
	tests := []struct {
		name  string
		names []string
		want  string
	}{
		{name: "direct", names: []string{"李雷"}, want: "李雷"},
		{name: "two", names: []string{"李雷", "韩梅梅"}, want: "李雷、韩梅梅"},
		{name: "group", names: []string{"李雷", "韩梅梅", "王强"}, want: "李雷、韩梅梅 等"},
		{name: "empty", names: nil, want: "会话"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := buildSessionTitle(tt.names); got != tt.want {
				t.Fatalf("buildSessionTitle() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestCanRevokeMessageRequiresSenderRecentAndSent(t *testing.T) {
	now := time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)

	tests := []struct {
		name      string
		requester int64
		msg       MessageRow
		want      bool
	}{
		{
			name:      "sender recent sent message",
			requester: 5,
			msg:       MessageRow{SenderID: 5, MessageType: "TEXT", CreatedAt: now.Add(-time.Minute), Content: "hello"},
			want:      true,
		},
		{
			name:      "not sender",
			requester: 6,
			msg:       MessageRow{SenderID: 5, MessageType: "TEXT", CreatedAt: now.Add(-time.Minute), Content: "hello"},
			want:      false,
		},
		{
			name:      "too old",
			requester: 5,
			msg:       MessageRow{SenderID: 5, MessageType: "TEXT", CreatedAt: now.Add(-3 * time.Minute), Content: "hello"},
			want:      false,
		},
		{
			name:      "system",
			requester: 5,
			msg:       MessageRow{SenderID: 5, MessageType: "SYSTEM", CreatedAt: now.Add(-time.Minute), Content: "created"},
			want:      false,
		},
		{
			name:      "already revoked",
			requester: 5,
			msg:       MessageRow{SenderID: 5, MessageType: "TEXT", Status: "REVOKED", CreatedAt: now.Add(-time.Minute), Content: "hello"},
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := canRevokeMessage(tt.requester, tt.msg, now); got != tt.want {
				t.Fatalf("canRevokeMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUnreadCountUsesLastReadMessageID(t *testing.T) {
	messages := []MessageRow{
		{ID: 1, SenderID: 2, MessageType: "TEXT", Status: "SENT"},
		{ID: 2, SenderID: 1, MessageType: "TEXT", Status: "SENT"},
		{ID: 3, SenderID: 2, MessageType: "SYSTEM", Status: "SENT"},
		{ID: 4, SenderID: 2, MessageType: "TEXT", Status: "REVOKED"},
		{ID: 5, SenderID: 2, MessageType: "TEXT", Status: "SENT"},
	}

	if got := unreadCountAfterMessage(1, 2, messages); got != 1 {
		t.Fatalf("unreadCountAfterMessage() = %d, want 1", got)
	}
}

func TestReadCountForMessage(t *testing.T) {
	reads := map[int64]int64{
		1: 10,
		2: 4,
		3: 5,
		4: 0,
	}

	if got := readCountForMessage(5, 1, reads); got != 1 {
		t.Fatalf("readCountForMessage() = %d, want 1", got)
	}
}

func TestChatUserSearchLimit(t *testing.T) {
	if chatUserSearchLimit != 100 {
		t.Fatalf("chatUserSearchLimit = %d, want 100", chatUserSearchLimit)
	}
}
