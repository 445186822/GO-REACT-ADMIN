-- Scheduled Tasks
CREATE TABLE IF NOT EXISTS sys_scheduled_tasks (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cron_expr TEXT NOT NULL DEFAULT '',
    task_type TEXT NOT NULL DEFAULT 'CUSTOM',
    config JSONB NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ NULL,
    next_run_at TIMESTAMPTZ NULL,
    remark TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sys_task_executions (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES sys_scheduled_tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ NULL,
    output TEXT NULL,
    error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_exec_task ON sys_task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_exec_started ON sys_task_executions(started_at DESC);

-- Knowledge Base
CREATE TABLE IF NOT EXISTS kb_categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id BIGINT NULL REFERENCES kb_categories(id),
    sort_order INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_articles (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category_id BIGINT NULL REFERENCES kb_categories(id),
    tags TEXT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    view_count INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PUBLISHED',
    author_id BIGINT NULL REFERENCES sys_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_created ON kb_articles(created_at DESC);

CREATE TABLE IF NOT EXISTS kb_faqs (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    category_id BIGINT NULL REFERENCES kb_categories(id),
    sort_order INT NOT NULL DEFAULT 0,
    view_count INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_faqs_category ON kb_faqs(category_id);
