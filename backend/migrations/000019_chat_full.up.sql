ALTER TABLE chat_participants
    ADD COLUMN IF NOT EXISTS last_read_message_id BIGINT NULL,
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_chat_participants_visible ON chat_participants(user_id, removed_at);

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'SENT',
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS revoked_by BIGINT NULL REFERENCES sys_users(id),
    ADD COLUMN IF NOT EXISTS reply_to_id BIGINT NULL,
    ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_chat_messages_attachment
    ON chat_messages(session_id, message_type)
    WHERE message_type IN ('IMAGE', 'FILE');
