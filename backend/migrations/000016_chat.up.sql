-- Chat system: sessions table
CREATE TABLE chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    created_by BIGINT NOT NULL REFERENCES sys_users(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Chat participants: tracks who is in each session and their last read time
CREATE TABLE chat_participants (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES sys_users(id),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_message_id BIGINT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    muted BOOLEAN NOT NULL DEFAULT false,
    removed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_chat_participants_unique ON chat_participants(session_id, user_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX idx_chat_participants_visible ON chat_participants(user_id, removed_at);

-- Chat messages: individual messages within a session
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES sys_users(id),
    sender_name TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL DEFAULT 'TEXT',
    content TEXT NOT NULL DEFAULT '',
    attachment_url TEXT NULL,
    status TEXT NOT NULL DEFAULT 'SENT',
    revoked_at TIMESTAMPTZ NULL,
    revoked_by BIGINT NULL REFERENCES sys_users(id),
    reply_to_id BIGINT NULL,
    file_name TEXT NOT NULL DEFAULT '',
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id, created_at DESC);
CREATE INDEX idx_chat_messages_attachment ON chat_messages(session_id, message_type) WHERE message_type IN ('IMAGE', 'FILE');
