DROP INDEX IF EXISTS idx_chat_messages_attachment;
DROP INDEX IF EXISTS idx_chat_participants_visible;

ALTER TABLE chat_messages
    DROP COLUMN IF EXISTS mime_type,
    DROP COLUMN IF EXISTS file_size,
    DROP COLUMN IF EXISTS file_name,
    DROP COLUMN IF EXISTS reply_to_id,
    DROP COLUMN IF EXISTS revoked_by,
    DROP COLUMN IF EXISTS revoked_at,
    DROP COLUMN IF EXISTS status;

ALTER TABLE chat_participants
    DROP COLUMN IF EXISTS removed_at,
    DROP COLUMN IF EXISTS muted,
    DROP COLUMN IF EXISTS is_pinned,
    DROP COLUMN IF EXISTS last_read_message_id;
