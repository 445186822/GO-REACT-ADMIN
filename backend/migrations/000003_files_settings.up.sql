CREATE TABLE IF NOT EXISTS sys_settings (
    id BIGSERIAL PRIMARY KEY,
    group_key TEXT NOT NULL,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'string',
    description TEXT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sys_files (
    id BIGSERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    uploader_id BIGINT NOT NULL REFERENCES sys_users(id),
    biz_type TEXT NULL,
    biz_id BIGINT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sys_files_uploader ON sys_files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_sys_files_biz ON sys_files(biz_type, biz_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_logs_created_at ON sys_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_logs_user_id ON sys_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_logs_resource ON sys_audit_logs(resource);
