DROP INDEX IF EXISTS idx_workflow_status_mappings_workflow;
DROP INDEX IF EXISTS idx_workflow_bindings_biz_type;
DROP TABLE IF EXISTS workflow_status_mappings;
DROP TABLE IF EXISTS workflow_bindings;

ALTER TABLE approval_instances
DROP COLUMN IF EXISTS status_dict_code,
DROP COLUMN IF EXISTS business_status;
