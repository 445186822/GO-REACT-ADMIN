ALTER TABLE approval_instances
ADD COLUMN IF NOT EXISTS business_status TEXT NULL,
ADD COLUMN IF NOT EXISTS status_dict_code TEXT NULL;

CREATE TABLE IF NOT EXISTS workflow_bindings (
    id BIGSERIAL PRIMARY KEY,
    workflow_definition_id BIGINT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    biz_type TEXT NOT NULL,
    adapter_code TEXT NOT NULL,
    status_dict_code TEXT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workflow_definition_id, biz_type)
);

CREATE TABLE IF NOT EXISTS workflow_status_mappings (
    id BIGSERIAL PRIMARY KEY,
    workflow_definition_id BIGINT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    node_key TEXT NOT NULL,
    action_code TEXT NOT NULL,
    workflow_status TEXT NOT NULL,
    business_status TEXT NOT NULL,
    status_dict_code TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workflow_definition_id, node_key, action_code)
);

CREATE INDEX IF NOT EXISTS idx_workflow_bindings_biz_type ON workflow_bindings(biz_type, enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_status_mappings_workflow ON workflow_status_mappings(workflow_definition_id, node_key, action_code);
