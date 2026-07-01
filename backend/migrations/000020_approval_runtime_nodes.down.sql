ALTER TABLE approval_actions
DROP COLUMN IF EXISTS to_node_key,
DROP COLUMN IF EXISTS from_node_key,
DROP COLUMN IF EXISTS instance_node_id;

DROP INDEX IF EXISTS idx_approval_instance_nodes_running;
DROP INDEX IF EXISTS idx_approval_instance_nodes_instance;
DROP TABLE IF EXISTS approval_instance_nodes;

ALTER TABLE approval_instances
DROP COLUMN IF EXISTS current_node_key,
DROP COLUMN IF EXISTS workflow_snapshot;
