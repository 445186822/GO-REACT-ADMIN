package chat

import "testing"

func strPtr(value string) *string {
	return &value
}

func TestMarkMissingMessageAttachmentsClearsDeletedFiles(t *testing.T) {
	messages := []MessageRow{
		{ID: 1, MessageType: "IMAGE", AttachmentURL: strPtr("1"), Content: "image.png"},
		{ID: 2, MessageType: "FILE", AttachmentURL: strPtr("/api/v1/files/2/download"), Content: "doc.pdf"},
		{ID: 3, MessageType: "TEXT", AttachmentURL: strPtr("3"), Content: "plain"},
	}

	markMissingMessageAttachments(messages, map[int64]struct{}{2: {}})

	if messages[0].AttachmentURL != nil {
		t.Fatalf("deleted image attachment should be cleared, got %q", *messages[0].AttachmentURL)
	}
	if messages[1].AttachmentURL == nil || *messages[1].AttachmentURL != "/api/v1/files/2/download" {
		t.Fatalf("existing file attachment should be kept, got %#v", messages[1].AttachmentURL)
	}
	if messages[2].AttachmentURL == nil || *messages[2].AttachmentURL != "3" {
		t.Fatalf("text message attachment_url should not be touched, got %#v", messages[2].AttachmentURL)
	}
}

func TestAvailableSharedFilesSkipsMissingAttachments(t *testing.T) {
	messages := []MessageRow{
		{ID: 1, MessageType: "IMAGE", AttachmentURL: nil, Content: "missing.png"},
		{ID: 2, MessageType: "FILE", AttachmentURL: strPtr("2"), Content: "doc.pdf"},
	}

	files := availableSharedFiles(messages)

	if len(files) != 1 || files[0].ID != 2 {
		t.Fatalf("availableSharedFiles() = %#v, want only message 2", files)
	}
}
