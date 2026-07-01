package collaboration

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

func insertApprovalInstanceNodes(ctx context.Context, tx pgx.Tx, instanceID int64, nodes []approvalRuntimeNode) error {
	for _, node := range nodes {
		config, err := json.Marshal(node.Config)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO approval_instance_nodes (instance_id, node_key, node_name, node_type, assignee, step_index, status, config, started_at, completed_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,
        CASE WHEN $7 <> 'WAITING' THEN now() ELSE NULL END,
        CASE WHEN $7 IN ('APPROVED','REJECTED') THEN now() ELSE NULL END)`,
			instanceID, node.Key, node.Name, node.NodeType, node.Assignee, node.StepIndex, node.Status, string(config)); err != nil {
			return err
		}
	}
	return nil
}

func listApprovalRuntimeNodes(ctx context.Context, tx pgx.Tx, instanceID int64) ([]approvalRuntimeNode, map[string]int64, error) {
	rows, err := tx.Query(ctx, `
SELECT id, node_key, node_name, node_type, assignee, step_index, status, config
FROM approval_instance_nodes
WHERE instance_id = $1
ORDER BY id`, instanceID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	nodes := make([]approvalRuntimeNode, 0)
	idByKey := make(map[string]int64)
	for rows.Next() {
		var (
			id     int64
			node   approvalRuntimeNode
			config json.RawMessage
		)
		if err := rows.Scan(&id, &node.Key, &node.Name, &node.NodeType, &node.Assignee, &node.StepIndex, &node.Status, &config); err != nil {
			return nil, nil, err
		}
		node.Config = parseWorkflowNodeConfig(config)
		nodes = append(nodes, node)
		idByKey[node.Key] = id
	}
	return nodes, idByKey, rows.Err()
}

func updateApprovalInstanceNodes(ctx context.Context, tx pgx.Tx, instanceID int64, nodes []approvalRuntimeNode) error {
	for _, node := range nodes {
		if _, err := tx.Exec(ctx, `
UPDATE approval_instance_nodes
SET status = $3,
    started_at = CASE WHEN started_at IS NULL AND $3 <> 'WAITING' THEN now() ELSE started_at END,
    completed_at = CASE WHEN $3 IN ('APPROVED','REJECTED') THEN COALESCE(completed_at, now()) ELSE completed_at END,
    updated_at = now()
WHERE instance_id = $1 AND node_key = $2`, instanceID, node.Key, node.Status); err != nil {
			return err
		}
	}
	return nil
}

func listApprovalNodes(ctx context.Context, q collaborationQueryer, instanceID int64) ([]ApprovalNodeRow, error) {
	rows, err := q.Query(ctx, `
SELECT id, node_key, node_name, node_type, assignee, step_index, status, config, started_at, completed_at
FROM approval_instance_nodes
WHERE instance_id = $1
ORDER BY id`, instanceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ApprovalNodeRow, 0)
	for rows.Next() {
		var item ApprovalNodeRow
		if err := rows.Scan(&item.ID, &item.NodeKey, &item.NodeName, &item.NodeType, &item.Assignee, &item.StepIndex, &item.Status, &item.Config, &item.StartedAt, &item.CompletedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
