ALTER TABLE approval_instances
ADD COLUMN IF NOT EXISTS workflow_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS current_node_key TEXT NULL;

CREATE TABLE IF NOT EXISTS approval_instance_nodes (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES approval_instances(id) ON DELETE CASCADE,
    node_key TEXT NOT NULL,
    node_name TEXT NOT NULL,
    node_type TEXT NOT NULL,
    assignee TEXT NOT NULL DEFAULT '',
    step_index INTEGER NOT NULL DEFAULT -1,
    status TEXT NOT NULL DEFAULT 'WAITING',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(instance_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_approval_instance_nodes_instance ON approval_instance_nodes(instance_id, step_index);
CREATE INDEX IF NOT EXISTS idx_approval_instance_nodes_running ON approval_instance_nodes(status, node_type, assignee);

ALTER TABLE approval_actions
ADD COLUMN IF NOT EXISTS instance_node_id BIGINT NULL REFERENCES approval_instance_nodes(id),
ADD COLUMN IF NOT EXISTS from_node_key TEXT NULL,
ADD COLUMN IF NOT EXISTS to_node_key TEXT NULL;
