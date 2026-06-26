ALTER TABLE approval_templates
ADD COLUMN IF NOT EXISTS workflow_definition_id BIGINT NULL REFERENCES workflow_definitions(id);

CREATE INDEX IF NOT EXISTS idx_approval_templates_workflow
ON approval_templates(workflow_definition_id);

UPDATE approval_templates tpl
SET workflow_definition_id = wd.id
FROM workflow_definitions wd
WHERE tpl.biz_type = 'leave'
  AND wd.name = '请假审批流程'
  AND tpl.workflow_definition_id IS NULL;
