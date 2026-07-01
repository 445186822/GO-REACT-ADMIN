package collaboration

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/jackc/pgx/v5"
)

type workflowBusinessBinding struct {
	AdapterCode    string
	StatusDictCode string
}

type workflowBusinessStatusMapping struct {
	WorkflowDefinitionID int64
	NodeKey              string
	ActionCode           string
	WorkflowStatus       string
	BusinessStatus       string
	StatusDictCode       string
}

func workflowBusinessMappingsFromDefinition(workflowID int64, raw json.RawMessage) []workflowBusinessStatusMapping {
	graph := parseWorkflowRuntimeGraph(raw)
	mappings := make([]workflowBusinessStatusMapping, 0)
	for _, node := range graph.Nodes {
		for _, action := range node.Config.Actions {
			if strings.TrimSpace(action.BusinessStatus) == "" {
				continue
			}
			mappings = append(mappings, workflowBusinessStatusMapping{
				WorkflowDefinitionID: workflowID,
				NodeKey:              node.Key,
				ActionCode:           action.Code,
				WorkflowStatus:       firstNonEmpty(action.InstanceStatus, approvalStatusPending),
				BusinessStatus:       strings.TrimSpace(action.BusinessStatus),
			})
		}
		if node.NodeType == "end" && strings.TrimSpace(node.Config.FinalBusinessStatus) != "" {
			mappings = append(mappings, workflowBusinessStatusMapping{
				WorkflowDefinitionID: workflowID,
				NodeKey:              node.Key,
				ActionCode:           "COMPLETE",
				WorkflowStatus:       firstNonEmpty(node.Config.FinalStatus, approvalStatusApproved),
				BusinessStatus:       strings.TrimSpace(node.Config.FinalBusinessStatus),
			})
		}
	}
	return mappings
}

func syncWorkflowBusinessMappings(ctx context.Context, tx pgx.Tx, workflowID int64, raw json.RawMessage) error {
	if _, err := tx.Exec(ctx, `DELETE FROM workflow_status_mappings WHERE workflow_definition_id = $1`, workflowID); err != nil {
		return err
	}
	for _, mapping := range workflowBusinessMappingsFromDefinition(workflowID, raw) {
		if _, err := tx.Exec(ctx, `
INSERT INTO workflow_status_mappings (workflow_definition_id, node_key, action_code, workflow_status, business_status, status_dict_code)
VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))
ON CONFLICT (workflow_definition_id, node_key, action_code)
DO UPDATE SET workflow_status = EXCLUDED.workflow_status,
              business_status = EXCLUDED.business_status,
              status_dict_code = EXCLUDED.status_dict_code,
              updated_at = now()`,
			workflowID, mapping.NodeKey, mapping.ActionCode, mapping.WorkflowStatus, mapping.BusinessStatus, mapping.StatusDictCode); err != nil {
			return err
		}
	}
	return nil
}

func upsertWorkflowBinding(ctx context.Context, tx pgx.Tx, workflowID int64, bizType string, adapterCode string, statusDictCode string) error {
	bizType = strings.TrimSpace(bizType)
	adapterCode = strings.TrimSpace(adapterCode)
	if bizType == "" || adapterCode == "" {
		_, err := tx.Exec(ctx, `DELETE FROM workflow_bindings WHERE workflow_definition_id = $1`, workflowID)
		return err
	}
	_, err := tx.Exec(ctx, `
INSERT INTO workflow_bindings (workflow_definition_id, biz_type, adapter_code, status_dict_code, enabled)
VALUES ($1, $2, $3, NULLIF($4, ''), true)
ON CONFLICT (workflow_definition_id, biz_type)
DO UPDATE SET adapter_code = EXCLUDED.adapter_code,
              status_dict_code = EXCLUDED.status_dict_code,
              enabled = true,
              updated_at = now()`, workflowID, bizType, adapterCode, strings.TrimSpace(statusDictCode))
	return err
}

func loadWorkflowBusinessBinding(ctx context.Context, tx pgx.Tx, workflowID int64, bizType string) (workflowBusinessBinding, bool, error) {
	var binding workflowBusinessBinding
	err := tx.QueryRow(ctx, `
SELECT adapter_code, COALESCE(status_dict_code, '')
FROM workflow_bindings
WHERE workflow_definition_id = $1
  AND biz_type = $2
  AND enabled = true`, workflowID, bizType).Scan(&binding.AdapterCode, &binding.StatusDictCode)
	if err != nil {
		if err == pgx.ErrNoRows {
			return workflowBusinessBinding{}, false, nil
		}
		return workflowBusinessBinding{}, false, err
	}
	return binding, true, nil
}

func loadWorkflowBusinessStatusMapping(ctx context.Context, tx pgx.Tx, workflowID int64, nodeKey string, action string) (workflowBusinessStatusMapping, bool, error) {
	var mapping workflowBusinessStatusMapping
	err := tx.QueryRow(ctx, `
SELECT workflow_status, business_status, COALESCE(status_dict_code, '')
FROM workflow_status_mappings
WHERE workflow_definition_id = $1
  AND node_key = $2
  AND upper(action_code) = upper($3)`, workflowID, nodeKey, action).Scan(&mapping.WorkflowStatus, &mapping.BusinessStatus, &mapping.StatusDictCode)
	if err != nil {
		if err == pgx.ErrNoRows {
			return workflowBusinessStatusMapping{}, false, nil
		}
		return workflowBusinessStatusMapping{}, false, err
	}
	return mapping, true, nil
}

func (h *Handler) applyWorkflowBusinessTransition(
	ctx context.Context,
	tx pgx.Tx,
	workflowID int64,
	instanceID int64,
	nodeKey string,
	action string,
	bizType string,
	bizID *string,
	plan approvalRuntimePlan,
	actorID int64,
) (approvalRuntimePlan, error) {
	businessStatus := strings.TrimSpace(plan.BusinessStatus)
	statusDictCode := ""
	adapterCode := ""

	if mapping, ok, err := loadWorkflowBusinessStatusMapping(ctx, tx, workflowID, nodeKey, action); err != nil {
		return plan, err
	} else if ok {
		if strings.TrimSpace(mapping.WorkflowStatus) != "" {
			plan.InstanceStatus = strings.TrimSpace(mapping.WorkflowStatus)
		}
		businessStatus = strings.TrimSpace(mapping.BusinessStatus)
		statusDictCode = strings.TrimSpace(mapping.StatusDictCode)
	}

	if binding, ok, err := loadWorkflowBusinessBinding(ctx, tx, workflowID, bizType); err != nil {
		return plan, err
	} else if ok {
		adapterCode = binding.AdapterCode
		if statusDictCode == "" {
			statusDictCode = binding.StatusDictCode
		}
	}

	if businessStatus == "" {
		return plan, nil
	}
	if _, err := tx.Exec(ctx, `
UPDATE approval_instances
SET business_status = $2, status_dict_code = NULLIF($3, ''), updated_at = now()
WHERE id = $1`, instanceID, businessStatus, statusDictCode); err != nil {
		return plan, err
	}
	if bizID == nil || strings.TrimSpace(*bizID) == "" || adapterCode == "" {
		return plan, nil
	}
	_, err := h.business.Apply(ctx, tx, WorkflowBusinessTransition{
		WorkflowDefinitionID: workflowID,
		InstanceID:           instanceID,
		NodeKey:              nodeKey,
		Action:               action,
		AdapterCode:          adapterCode,
		BizType:              bizType,
		BizID:                strings.TrimSpace(*bizID),
		WorkflowStatus:       plan.InstanceStatus,
		BusinessStatus:       businessStatus,
		StatusDictCode:       statusDictCode,
		ActorID:              actorID,
	})
	return plan, err
}
