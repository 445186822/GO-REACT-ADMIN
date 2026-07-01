package collaboration

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5"
)

type runtimeApprovalActionResult struct {
	Status          string
	NextAssignee    string
	NotifyApplicant bool
}

func (h *Handler) listPendingRuntimeTodos(ctx context.Context, roles []string) ([]TodoRow, error) {
	rows, err := h.db.Query(ctx, `
SELECT ain.id, ai.id, ai.title, ai.biz_type, ai.biz_id, u.display_name,
       ain.step_index, ain.node_name, ain.assignee, ai.created_at, ai.status
FROM approval_instance_nodes ain
JOIN approval_instances ai ON ai.id = ain.instance_id AND ai.deleted_at IS NULL
JOIN sys_users u ON u.id = ai.applicant_id
WHERE ai.status = 'PENDING'
  AND ain.status = 'RUNNING'
  AND ain.node_type = 'approval'
ORDER BY ai.created_at DESC, ain.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TodoRow, 0)
	for rows.Next() {
		var (
			nodeID     int64
			instanceID int64
			title      string
			bizType    string
			bizID      *string
			applicant  string
			stepIndex  int
			nodeName   string
			assignee   string
			createdAt  time.Time
			status     string
		)
		if err := rows.Scan(&nodeID, &instanceID, &title, &bizType, &bizID, &applicant, &stepIndex, &nodeName, &assignee, &createdAt, &status); err != nil {
			return nil, err
		}
		if !assigneeMatchesRoles(assignee, roles) {
			continue
		}
		items = append(items, TodoRow{
			ID:              nodeID,
			SourceModule:    "approval",
			SourceID:        instanceID,
			Title:           title,
			BizType:         bizType,
			BizID:           bizID,
			Applicant:       applicant,
			CurrentStep:     stepIndex,
			CurrentStepName: nodeName,
			Assignee:        assignee,
			CreatedAt:       createdAt,
			TodoStatus:      "pending",
			ApprovalStatus:  status,
		})
	}
	return items, rows.Err()
}

func (h *Handler) actionRuntimeApproval(
	ctx context.Context,
	tx pgx.Tx,
	workflowID int64,
	instanceID int64,
	title string,
	applicantID int64,
	bizType string,
	bizID *string,
	currentNodeKey string,
	workflowSnapshot json.RawMessage,
	formData json.RawMessage,
	req ApprovalActionRequest,
	actorID int64,
	activeRole string,
) (runtimeApprovalActionResult, bool, error) {
	_ = title
	_ = applicantID
	nodes, idByKey, err := listApprovalRuntimeNodes(ctx, tx, instanceID)
	if err != nil {
		return runtimeApprovalActionResult{}, false, err
	}
	if len(nodes) == 0 {
		return runtimeApprovalActionResult{}, false, nil
	}
	currentIndex, ok := runtimeNodeIndex(nodes, currentNodeKey)
	if !ok {
		return runtimeApprovalActionResult{}, false, nil
	}
	currentNode := nodes[currentIndex]
	roles, err := h.currentUserRoleLabels(ctx, actorID, activeRole)
	if err != nil {
		return runtimeApprovalActionResult{}, true, err
	}
	if !assigneeMatchesRoles(currentNode.Assignee, roles) {
		return runtimeApprovalActionResult{}, true, response.NewError(http.StatusForbidden, "APPROVAL_ASSIGNEE_MISMATCH", "current approval node assignee does not match your roles")
	}

	plan, err := buildApprovalActionPlan(workflowSnapshot, nodes, currentNodeKey, req.Action, req.Comment, formData)
	if err != nil {
		return runtimeApprovalActionResult{}, true, response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO approval_actions (instance_id, instance_node_id, step_index, from_node_key, to_node_key, approver_id, action, comment)
VALUES ($1,$2,$3,$4,NULLIF($5, ''),$6,$7,$8)`,
		instanceID, idByKey[currentNodeKey], currentNode.StepIndex, currentNodeKey, plan.CurrentNodeKey, actorID, req.Action, req.Comment); err != nil {
		return runtimeApprovalActionResult{}, true, err
	}
	if err := updateApprovalInstanceNodes(ctx, tx, instanceID, plan.Nodes); err != nil {
		return runtimeApprovalActionResult{}, true, err
	}
	plan, err = h.applyWorkflowBusinessTransition(ctx, tx, workflowID, instanceID, currentNodeKey, req.Action, bizType, bizID, plan, actorID)
	if err != nil {
		return runtimeApprovalActionResult{}, true, err
	}
	if _, err := tx.Exec(ctx, `
UPDATE approval_instances
SET status = $2, current_step = $3, current_node_key = NULLIF($4, ''), updated_at = now()
WHERE id = $1`, instanceID, plan.InstanceStatus, plan.CurrentStep, plan.CurrentNodeKey); err != nil {
		return runtimeApprovalActionResult{}, true, err
	}

	result := runtimeApprovalActionResult{Status: plan.InstanceStatus}
	if plan.InstanceStatus == approvalStatusPending && plan.CurrentNodeKey != "" {
		if nextIndex, ok := runtimeNodeIndex(plan.Nodes, plan.CurrentNodeKey); ok {
			result.NextAssignee = plan.Nodes[nextIndex].Assignee
		}
	} else {
		result.NotifyApplicant = workflowHasNotificationNode(workflowSnapshot) || plan.InstanceStatus != approvalStatusPending
	}
	return result, true, nil
}
