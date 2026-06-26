CREATE TABLE IF NOT EXISTS sys_recycled (
    id BIGSERIAL PRIMARY KEY,
    source_table TEXT NOT NULL,
    source_id BIGINT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    deleted_by BIGINT NULL REFERENCES sys_users(id),
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sys_recycled_table ON sys_recycled(source_table);
CREATE INDEX IF NOT EXISTS idx_sys_recycled_deleted_at ON sys_recycled(deleted_at DESC);
