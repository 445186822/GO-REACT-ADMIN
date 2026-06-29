package chat

import "time"

const (
	chatUserSearchLimit = 100
	revokeWindow        = 2 * time.Minute
)

func buildParticipantIDs(currentUserID int64, userIDs []int64) []int64 {
	ids := []int64{currentUserID}
	seen := map[int64]bool{currentUserID: true}
	for _, id := range userIDs {
		if id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	return ids
}

func buildSessionTitle(names []string) string {
	switch {
	case len(names) == 0:
		return "会话"
	case len(names) == 1:
		return names[0]
	case len(names) == 2:
		return names[0] + "、" + names[1]
	default:
		return names[0] + "、" + names[1] + " 等"
	}
}

func canRevokeMessage(requesterID int64, msg MessageRow, now time.Time) bool {
	if requesterID == 0 || msg.SenderID != requesterID {
		return false
	}
	if msg.MessageType == "SYSTEM" || msg.Status == "REVOKED" || msg.RevokedAt != nil {
		return false
	}
	return now.Sub(msg.CreatedAt) <= revokeWindow
}

func unreadCountAfterMessage(currentUserID int64, lastReadMessageID int64, messages []MessageRow) int64 {
	var count int64
	for _, msg := range messages {
		if msg.ID <= lastReadMessageID {
			continue
		}
		if msg.SenderID == currentUserID || msg.MessageType == "SYSTEM" || msg.Status == "REVOKED" {
			continue
		}
		count++
	}
	return count
}

func readCountForMessage(messageID int64, senderID int64, participantReads map[int64]int64) int64 {
	var count int64
	for userID, lastReadMessageID := range participantReads {
		if userID == senderID {
			continue
		}
		if lastReadMessageID >= messageID {
			count++
		}
	}
	return count
}
