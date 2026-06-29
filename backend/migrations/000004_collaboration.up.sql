CREATE TABLE sys_notifications (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    notif_type TEXT NOT NULL DEFAULT 'system',
    source_module TEXT NOT NULL DEFAULT 'system',
    recipient_id BIGINT NULL REFERENCES sys_users(id),
    created_by BIGINT NULL REFERENCES sys_users(id),
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE msg_templates (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE approval_instances (
    id BIGSERIAL PRIMARY KEY,
    workflow_definition_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    biz_type TEXT NOT NULL,
    biz_id TEXT NULL,
    applicant_id BIGINT NOT NULL REFERENCES sys_users(id),
    status TEXT NOT NULL DEFAULT 'PENDING',
    current_step INTEGER NOT NULL DEFAULT 0,
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE approval_actions (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES approval_instances(id),
    step_index INTEGER NOT NULL,
    approver_id BIGINT NOT NULL REFERENCES sys_users(id),
    action TEXT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_definitions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT NULL,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_by BIGINT NULL REFERENCES sys_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

ALTER TABLE approval_instances
ADD CONSTRAINT approval_instances_workflow_definition_id_fkey
FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id);

CREATE TABLE workflow_instances (
    id BIGSERIAL PRIMARY KEY,
    definition_id BIGINT NOT NULL REFERENCES workflow_definitions(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_by BIGINT NOT NULL REFERENCES sys_users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ NULL
);

CREATE TABLE workflow_logs (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES workflow_instances(id),
    node_key TEXT NOT NULL,
    node_name TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_assistant_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES sys_users(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sys_notifications_recipient ON sys_notifications(recipient_id, read_at, created_at DESC);
CREATE INDEX idx_approval_instances_applicant ON approval_instances(applicant_id, status, created_at DESC);
CREATE INDEX idx_workflow_instances_definition ON workflow_instances(definition_id, status, started_at DESC);
CREATE INDEX idx_ai_assistant_messages_user ON ai_assistant_messages(user_id, created_at DESC);
