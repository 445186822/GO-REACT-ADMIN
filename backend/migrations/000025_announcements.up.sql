-- Announcement / 公告模块
-- 替代旧的 sys_notifications 表，支持接收人管理、已读记录、过期机制

CREATE TABLE announcements (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'notice',     -- notice: 通知, announcement: 公告, reminder: 提醒
    priority TEXT NOT NULL DEFAULT 'normal',     -- normal / urgent
    status TEXT NOT NULL DEFAULT 'published',    -- draft / published / archived / expired
    created_by BIGINT NOT NULL REFERENCES sys_users(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expired_at TIMESTAMPTZ NULL,                 -- 过期时间，NULL=永不过期
    archived_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE announcement_recipients (
    id BIGSERIAL PRIMARY KEY,
    announcement_id BIGINT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES sys_users(id),
    read_at TIMESTAMPTZ NULL,                    -- NULL=未读，非NULL=已读时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(announcement_id, user_id)
);

CREATE INDEX idx_announcements_status ON announcements(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_announcements_created_by ON announcements(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_announcement_recipients_user ON announcement_recipients(user_id, read_at, announcement_id DESC);
CREATE INDEX idx_announcement_recipients_announcement ON announcement_recipients(announcement_id, read_at);
