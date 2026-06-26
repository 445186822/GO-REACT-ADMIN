DROP INDEX IF EXISTS idx_approval_templates_workflow;

ALTER TABLE approval_templates
DROP COLUMN IF EXISTS workflow_definition_id;
