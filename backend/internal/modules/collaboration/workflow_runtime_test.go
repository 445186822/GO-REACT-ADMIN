package collaboration

import (
	"encoding/json"
	"testing"
)

func TestBuildApprovalStartPlanCreatesNodeStatusesAndRunsFirstApproval(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"start","type":"workflowNode","data":{"key":"start","name":"Start","nodeType":"start"}},
			{"id":"dept","type":"workflowNode","data":{"key":"dept_approval","name":"Department approval","nodeType":"approval","assignee":"Department Manager","config":{"actions":[{"code":"APPROVE","label":"Approve","target":"end","instanceStatus":"APPROVED"}]}}},
			{"id":"end","type":"workflowNode","data":{"key":"end","name":"End","nodeType":"end","config":{"finalStatus":"APPROVED"}}}
		],
		"edges": [
			{"source":"start","target":"dept"},
			{"source":"dept","target":"end"}
		]
	}`)

	plan, err := buildApprovalStartPlan(raw, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("buildApprovalStartPlan returned error: %v", err)
	}

	if plan.InstanceStatus != "PENDING" {
		t.Fatalf("InstanceStatus = %q, want PENDING", plan.InstanceStatus)
	}
	if plan.CurrentNodeKey != "dept_approval" {
		t.Fatalf("CurrentNodeKey = %q, want dept_approval", plan.CurrentNodeKey)
	}
	if plan.CurrentStep != 0 {
		t.Fatalf("CurrentStep = %d, want 0", plan.CurrentStep)
	}
	assertRuntimeNodeStatus(t, plan.Nodes, "start", "APPROVED")
	assertRuntimeNodeStatus(t, plan.Nodes, "dept_approval", "RUNNING")
	assertRuntimeNodeStatus(t, plan.Nodes, "end", "WAITING")
}

func TestBuildApprovalActionPlanUsesConfiguredRejectTargetAndRequiresComment(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"start","type":"workflowNode","data":{"key":"start","name":"Start","nodeType":"start"}},
			{"id":"dept","type":"workflowNode","data":{"key":"dept_approval","name":"Department approval","nodeType":"approval","assignee":"Department Manager","config":{"actions":[
				{"code":"APPROVE","label":"Approve","target":"finance_approval","instanceStatus":"PENDING"},
				{"code":"REJECT","label":"Reject","target":"rejected_end","instanceStatus":"REJECTED","requireComment":true}
			]}}},
			{"id":"finance","type":"workflowNode","data":{"key":"finance_approval","name":"Finance approval","nodeType":"approval","assignee":"Finance"}},
			{"id":"rejected","type":"workflowNode","data":{"key":"rejected_end","name":"Rejected","nodeType":"end","config":{"finalStatus":"REJECTED"}}}
		],
		"edges": [
			{"source":"start","target":"dept"},
			{"source":"dept","target":"finance"},
			{"source":"dept","target":"rejected"}
		]
	}`)
	startPlan, err := buildApprovalStartPlan(raw, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("buildApprovalStartPlan returned error: %v", err)
	}

	if _, err := buildApprovalActionPlan(raw, startPlan.Nodes, "dept_approval", "REJECT", nil, json.RawMessage(`{}`)); err == nil {
		t.Fatal("expected REJECT without comment to fail")
	}

	comment := "not enough info"
	plan, err := buildApprovalActionPlan(raw, startPlan.Nodes, "dept_approval", "REJECT", &comment, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("buildApprovalActionPlan returned error: %v", err)
	}

	if plan.InstanceStatus != "REJECTED" {
		t.Fatalf("InstanceStatus = %q, want REJECTED", plan.InstanceStatus)
	}
	if plan.CurrentNodeKey != "" {
		t.Fatalf("CurrentNodeKey = %q, want empty after rejected end", plan.CurrentNodeKey)
	}
	assertRuntimeNodeStatus(t, plan.Nodes, "dept_approval", "REJECTED")
	assertRuntimeNodeStatus(t, plan.Nodes, "rejected_end", "REJECTED")
	assertRuntimeNodeStatus(t, plan.Nodes, "finance_approval", "WAITING")
}

func TestBuildApprovalActionPlanDefaultsApproveToApprovedAtEnd(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"start","type":"workflowNode","data":{"key":"start","name":"Start","nodeType":"start"}},
			{"id":"dept","type":"workflowNode","data":{"key":"dept_approval","name":"Department approval","nodeType":"approval"}},
			{"id":"end","type":"workflowNode","data":{"key":"end","name":"End","nodeType":"end"}}
		],
		"edges": [
			{"source":"start","target":"dept"},
			{"source":"dept","target":"end"}
		]
	}`)
	startPlan, err := buildApprovalStartPlan(raw, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("buildApprovalStartPlan returned error: %v", err)
	}

	plan, err := buildApprovalActionPlan(raw, startPlan.Nodes, "dept_approval", "APPROVE", nil, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("buildApprovalActionPlan returned error: %v", err)
	}

	if plan.InstanceStatus != "APPROVED" {
		t.Fatalf("InstanceStatus = %q, want APPROVED", plan.InstanceStatus)
	}
	if plan.CurrentStep != 0 {
		t.Fatalf("CurrentStep = %d, want last approval step 0", plan.CurrentStep)
	}
	assertRuntimeNodeStatus(t, plan.Nodes, "end", "APPROVED")
}

func TestBuildApprovalActionPlanCarriesBusinessStatusSeparately(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"start","type":"workflowNode","data":{"key":"start","name":"Start","nodeType":"start"}},
			{"id":"finance","type":"workflowNode","data":{"key":"finance_approval","name":"Finance approval","nodeType":"approval","config":{"actions":[
				{"code":"APPROVE","label":"Approve","target":"end","instanceStatus":"APPROVED","businessStatus":"WAIT_PAY"}
			]}}},
			{"id":"end","type":"workflowNode","data":{"key":"end","name":"End","nodeType":"end","config":{"finalStatus":"APPROVED","finalBusinessStatus":"PAID_APPROVED"}}}
		],
		"edges": [
			{"source":"start","target":"finance"},
			{"source":"finance","target":"end"}
		]
	}`)
	startPlan, err := buildApprovalStartPlan(raw, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("buildApprovalStartPlan returned error: %v", err)
	}

	plan, err := buildApprovalActionPlan(raw, startPlan.Nodes, "finance_approval", "APPROVE", nil, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("buildApprovalActionPlan returned error: %v", err)
	}

	if plan.InstanceStatus != "APPROVED" {
		t.Fatalf("InstanceStatus = %q, want APPROVED", plan.InstanceStatus)
	}
	if plan.BusinessStatus != "PAID_APPROVED" {
		t.Fatalf("BusinessStatus = %q, want PAID_APPROVED", plan.BusinessStatus)
	}
}

func TestBuildApprovalStartPlanEvaluatesConditionBranch(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"start","type":"workflowNode","data":{"key":"start","name":"Start","nodeType":"start"}},
			{"id":"amount","type":"workflowNode","data":{"key":"amount_check","name":"Amount check","nodeType":"condition","config":{"conditions":[
				{"expression":"form.amount > 1000","target":"manager_approval"}
			],"defaultTarget":"dept_approval"}}},
			{"id":"dept","type":"workflowNode","data":{"key":"dept_approval","name":"Department approval","nodeType":"approval","assignee":"Department Manager"}},
			{"id":"manager","type":"workflowNode","data":{"key":"manager_approval","name":"Manager approval","nodeType":"approval","assignee":"Manager"}},
			{"id":"end","type":"workflowNode","data":{"key":"end","name":"End","nodeType":"end"}}
		],
		"edges": [
			{"source":"start","target":"amount"},
			{"source":"amount","target":"dept"},
			{"source":"amount","target":"manager"},
			{"source":"dept","target":"end"},
			{"source":"manager","target":"end"}
		]
	}`)

	plan, err := buildApprovalStartPlan(raw, json.RawMessage(`{"amount":1500}`))
	if err != nil {
		t.Fatalf("buildApprovalStartPlan returned error: %v", err)
	}

	if plan.CurrentNodeKey != "manager_approval" {
		t.Fatalf("CurrentNodeKey = %q, want manager_approval", plan.CurrentNodeKey)
	}
	assertRuntimeNodeStatus(t, plan.Nodes, "amount_check", "APPROVED")
	assertRuntimeNodeStatus(t, plan.Nodes, "manager_approval", "RUNNING")
	assertRuntimeNodeStatus(t, plan.Nodes, "dept_approval", "WAITING")
}

func TestBuildApprovalStartPlanEvaluatesNumericStringConditionBranch(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"start","type":"workflowNode","data":{"key":"start","name":"Start","nodeType":"start"}},
			{"id":"amount","type":"workflowNode","data":{"key":"amount_check","name":"Amount check","nodeType":"condition","config":{"conditions":[
				{"expression":"form.amount > 1000","target":"manager_approval"}
			],"defaultTarget":"dept_approval"}}},
			{"id":"dept","type":"workflowNode","data":{"key":"dept_approval","name":"Department approval","nodeType":"approval","assignee":"Department Manager"}},
			{"id":"manager","type":"workflowNode","data":{"key":"manager_approval","name":"Manager approval","nodeType":"approval","assignee":"Manager"}}
		],
		"edges": [
			{"source":"start","target":"amount"},
			{"source":"amount","target":"dept"},
			{"source":"amount","target":"manager"}
		]
	}`)

	plan, err := buildApprovalStartPlan(raw, json.RawMessage(`{"amount":"1500"}`))
	if err != nil {
		t.Fatalf("buildApprovalStartPlan returned error: %v", err)
	}

	if plan.CurrentNodeKey != "manager_approval" {
		t.Fatalf("CurrentNodeKey = %q, want manager_approval", plan.CurrentNodeKey)
	}
}

func assertRuntimeNodeStatus(t *testing.T, nodes []approvalRuntimeNode, key string, want string) {
	t.Helper()
	for _, node := range nodes {
		if node.Key == key {
			if node.Status != want {
				t.Fatalf("node %s status = %q, want %q", key, node.Status, want)
			}
			return
		}
	}
	t.Fatalf("node %s not found in %#v", key, nodes)
}
