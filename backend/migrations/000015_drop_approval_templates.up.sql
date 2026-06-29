ALTER TABLE approval_instances
ADD COLUMN IF NOT EXISTS workflow_definition_id BIGINT NULL;

DO $$
BEGIN
    IF to_regclass('public.approval_templates') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'approval_instances'
             AND column_name = 'template_id'
       )
    THEN
        EXECUTE $sql$
            UPDATE approval_instances ai
            SET workflow_definition_id = at.workflow_definition_id
            FROM approval_templates at
            WHERE ai.template_id = at.id
              AND ai.workflow_definition_id IS NULL
              AND at.workflow_definition_id IS NOT NULL
        $sql$;
    END IF;
END $$;

UPDATE approval_instances ai
SET workflow_definition_id = wd.id
FROM workflow_definitions wd
WHERE ai.workflow_definition_id IS NULL
  AND wd.category = 'approval'
  AND wd.status = 'ACTIVE'
  AND wd.deleted_at IS NULL
  AND (
    (ai.biz_type ILIKE '%customer%' AND wd.name = '客户入驻流程')
    OR (ai.biz_type NOT ILIKE '%customer%' AND wd.name = '请假审批流程')
  );

DELETE FROM approval_actions
WHERE instance_id IN (
  SELECT id FROM approval_instances WHERE workflow_definition_id IS NULL
);

DELETE FROM approval_instances
WHERE workflow_definition_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'approval_instances_workflow_definition_id_fkey'
    ) THEN
        ALTER TABLE approval_instances
        ADD CONSTRAINT approval_instances_workflow_definition_id_fkey
        FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id);
    END IF;
END $$;

ALTER TABLE approval_instances
ALTER COLUMN workflow_definition_id SET NOT NULL;

ALTER TABLE approval_instances
DROP COLUMN IF EXISTS template_id;

DROP TABLE IF EXISTS approval_templates;

DELETE FROM sys_role_menus
WHERE menu_id IN (
  SELECT id FROM sys_menus
  WHERE code IN ('approval:template:create', 'approval:template:update', 'approval:template:delete')
);

DELETE FROM sys_menus
WHERE code IN ('approval:template:create', 'approval:template:update', 'approval:template:delete');
