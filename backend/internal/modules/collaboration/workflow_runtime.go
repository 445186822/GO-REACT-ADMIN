package collaboration

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

const (
	approvalNodeWaiting    = "WAITING"
	approvalNodeRunning    = "RUNNING"
	approvalNodeApproved   = "APPROVED"
	approvalNodeRejected   = "REJECTED"
	approvalStatusPending  = "PENDING"
	approvalStatusApproved = "APPROVED"
	approvalStatusRejected = "REJECTED"
)

type workflowNodeActionConfig struct {
	Code           string `json:"code"`
	Label          string `json:"label"`
	Target         string `json:"target"`
	InstanceStatus string `json:"instanceStatus"`
	BusinessStatus string `json:"businessStatus"`
	RequireComment bool   `json:"requireComment"`
}

type workflowConditionConfig struct {
	Expression string `json:"expression"`
	Expr       string `json:"expr"`
	Target     string `json:"target"`
}

type workflowNodeConfig struct {
	Actions               []workflowNodeActionConfig `json:"actions"`
	Conditions            []workflowConditionConfig  `json:"conditions"`
	DefaultTarget         string                     `json:"defaultTarget"`
	FinalStatus           string                     `json:"finalStatus"`
	FinalBusinessStatus   string                     `json:"finalBusinessStatus"`
	NotificationTemplate  string                     `json:"notificationTemplate"`
	NotificationRecipient string                     `json:"notificationRecipient"`
	NotificationTrigger   string                     `json:"notificationTrigger"`
	ActionName            string                     `json:"actionName"`
	ActionPayload         json.RawMessage            `json:"actionPayload"`
	WaitDuration          string                     `json:"waitDuration"`
	TimeoutAction         string                     `json:"timeoutAction"`
	TimeoutTarget         string                     `json:"timeoutTarget"`
}

type approvalRuntimeNode struct {
	Key       string             `json:"node_key"`
	Name      string             `json:"node_name"`
	NodeType  string             `json:"node_type"`
	Assignee  string             `json:"assignee"`
	Status    string             `json:"status"`
	StepIndex int                `json:"step_index"`
	Config    workflowNodeConfig `json:"config"`
}

type approvalRuntimePlan struct {
	Nodes          []approvalRuntimeNode
	InstanceStatus string
	BusinessStatus string
	CurrentNodeKey string
	CurrentStep    int
}

type workflowRuntimeGraph struct {
	Nodes      []approvalRuntimeNode
	Outgoing   map[string][]string
	indexByKey map[string]int
}

func buildApprovalStartPlan(raw json.RawMessage, formData json.RawMessage) (approvalRuntimePlan, error) {
	graph := parseWorkflowRuntimeGraph(raw)
	plan := approvalRuntimePlan{
		Nodes:          cloneApprovalRuntimeNodes(graph.Nodes),
		InstanceStatus: approvalStatusPending,
		CurrentStep:    0,
	}
	if len(graph.Nodes) == 0 {
		plan.InstanceStatus = approvalStatusApproved
		return plan, nil
	}
	startKey := graph.Nodes[0].Key
	for _, node := range graph.Nodes {
		if node.NodeType == "start" {
			startKey = node.Key
			break
		}
	}
	return advanceApprovalPlan(graph, plan, startKey, "", "", formData)
}

func buildApprovalActionPlan(raw json.RawMessage, nodes []approvalRuntimeNode, currentKey string, action string, comment *string, formData json.RawMessage) (approvalRuntimePlan, error) {
	graph := parseWorkflowRuntimeGraph(raw)
	plan := approvalRuntimePlan{
		Nodes:          mergeRuntimeNodeStatuses(graph.Nodes, nodes),
		InstanceStatus: approvalStatusPending,
	}
	index, ok := runtimeNodeIndex(plan.Nodes, currentKey)
	if !ok {
		return plan, fmt.Errorf("current approval node %q not found", currentKey)
	}
	current := plan.Nodes[index]
	plan.CurrentStep = current.StepIndex
	if current.NodeType != "approval" || current.Status != approvalNodeRunning {
		return plan, fmt.Errorf("current approval node %q is not running", currentKey)
	}
	actionConfig, ok := resolveApprovalAction(current.Config, action)
	if !ok {
		return plan, fmt.Errorf("action %s is not allowed on node %s", action, currentKey)
	}
	if actionConfig.RequireComment && (comment == nil || strings.TrimSpace(*comment) == "") {
		return plan, fmt.Errorf("comment is required for action %s", action)
	}
	if strings.EqualFold(action, "REJECT") || actionConfig.InstanceStatus == approvalStatusRejected {
		plan.Nodes[index].Status = approvalNodeRejected
	} else {
		plan.Nodes[index].Status = approvalNodeApproved
	}
	target := actionConfig.Target
	if target == "" {
		target = firstOutgoingTarget(graph, current.Key)
	}
	nextStatus := actionConfig.InstanceStatus
	if nextStatus == "" {
		nextStatus = approvalStatusPending
	}
	return advanceApprovalPlan(graph, plan, target, nextStatus, actionConfig.BusinessStatus, formData)
}

func advanceApprovalPlan(graph workflowRuntimeGraph, plan approvalRuntimePlan, startKey string, preferredStatus string, preferredBusinessStatus string, formData json.RawMessage) (approvalRuntimePlan, error) {
	if preferredStatus == "" {
		preferredStatus = approvalStatusPending
	}
	plan.BusinessStatus = preferredBusinessStatus
	visited := map[string]bool{}
	currentKey := startKey
	for currentKey != "" {
		if visited[currentKey] {
			return plan, fmt.Errorf("workflow has a cycle at node %s", currentKey)
		}
		visited[currentKey] = true
		index, ok := runtimeNodeIndex(plan.Nodes, currentKey)
		if !ok {
			return plan, fmt.Errorf("workflow target node %q not found", currentKey)
		}
		node := plan.Nodes[index]
		switch node.NodeType {
		case "approval":
			plan.Nodes[index].Status = approvalNodeRunning
			plan.CurrentNodeKey = node.Key
			plan.CurrentStep = node.StepIndex
			plan.InstanceStatus = preferredStatus
			if plan.InstanceStatus == "" {
				plan.InstanceStatus = approvalStatusPending
			}
			return plan, nil
		case "condition":
			plan.Nodes[index].Status = approvalNodeApproved
			currentKey = resolveConditionTarget(node.Config, formData)
			if currentKey == "" {
				currentKey = firstOutgoingTarget(graph, node.Key)
			}
		case "end":
			status := node.Config.FinalStatus
			if status == "" {
				if preferredStatus == approvalStatusRejected {
					status = approvalStatusRejected
				} else {
					status = approvalStatusApproved
				}
			}
			plan.InstanceStatus = status
			plan.CurrentNodeKey = ""
			if node.StepIndex >= 0 {
				plan.CurrentStep = node.StepIndex
			}
			if status == approvalStatusRejected {
				plan.Nodes[index].Status = approvalNodeRejected
			} else {
				plan.Nodes[index].Status = approvalNodeApproved
			}
			if node.Config.FinalBusinessStatus != "" {
				plan.BusinessStatus = node.Config.FinalBusinessStatus
			}
			return plan, nil
		default:
			plan.Nodes[index].Status = approvalNodeApproved
			currentKey = firstOutgoingTarget(graph, node.Key)
		}
	}
	plan.InstanceStatus = preferredStatus
	plan.CurrentNodeKey = ""
	return plan, nil
}

func parseWorkflowRuntimeGraph(raw json.RawMessage) workflowRuntimeGraph {
	var spec workflowDefinitionSpec
	if len(raw) == 0 || json.Unmarshal(raw, &spec) != nil || len(spec.Nodes) == 0 {
		spec = workflowDefinitionSpec{Nodes: []workflowDefinitionNode{
			{ID: "start", Key: "start", Type: "start", Name: "Start"},
			{ID: "end", Key: "end", Type: "end", Name: "End"},
		}}
	}
	ordered := orderWorkflowDefinitionNodes(spec)
	nodes := make([]approvalRuntimeNode, 0, len(ordered))
	approvalIndex := 0
	for _, node := range ordered {
		executable := node.executable()
		runtimeNode := approvalRuntimeNode{
			Key:       executable.Key,
			Name:      executable.Name,
			NodeType:  executable.NodeType,
			Assignee:  executable.Assignee,
			Status:    approvalNodeWaiting,
			StepIndex: -1,
			Config:    parseWorkflowNodeConfig(node.Data.Config),
		}
		if runtimeNode.NodeType == "approval" {
			runtimeNode.StepIndex = approvalIndex
			approvalIndex++
		}
		nodes = append(nodes, runtimeNode)
	}

	idToKey := make(map[string]string, len(spec.Nodes))
	for index, node := range spec.Nodes {
		idToKey[node.identity(index)] = node.executable().Key
	}
	outgoing := make(map[string][]string)
	for _, edge := range spec.Edges {
		source := idToKey[edge.Source]
		target := idToKey[edge.Target]
		if source == "" || target == "" {
			continue
		}
		outgoing[source] = append(outgoing[source], target)
	}
	if len(spec.Edges) == 0 {
		for index := 0; index < len(nodes)-1; index++ {
			outgoing[nodes[index].Key] = append(outgoing[nodes[index].Key], nodes[index+1].Key)
		}
	}
	indexByKey := make(map[string]int, len(nodes))
	for index, node := range nodes {
		indexByKey[node.Key] = index
	}
	return workflowRuntimeGraph{Nodes: nodes, Outgoing: outgoing, indexByKey: indexByKey}
}

func parseWorkflowNodeConfig(raw json.RawMessage) workflowNodeConfig {
	if len(raw) == 0 || string(raw) == "null" {
		return workflowNodeConfig{}
	}
	var config workflowNodeConfig
	if err := json.Unmarshal(raw, &config); err != nil {
		return workflowNodeConfig{}
	}
	return config
}

func resolveApprovalAction(config workflowNodeConfig, action string) (workflowNodeActionConfig, bool) {
	for _, item := range config.Actions {
		if strings.EqualFold(item.Code, action) {
			return item, true
		}
	}
	if len(config.Actions) > 0 {
		return workflowNodeActionConfig{}, false
	}
	if strings.EqualFold(action, "REJECT") {
		return workflowNodeActionConfig{Code: "REJECT", Label: "Reject", InstanceStatus: approvalStatusRejected}, true
	}
	if strings.EqualFold(action, "APPROVE") {
		return workflowNodeActionConfig{Code: "APPROVE", Label: "Approve", InstanceStatus: approvalStatusPending}, true
	}
	return workflowNodeActionConfig{}, false
}

func resolveConditionTarget(config workflowNodeConfig, formData json.RawMessage) string {
	for _, condition := range config.Conditions {
		expression := firstNonEmpty(condition.Expression, condition.Expr)
		if strings.EqualFold(strings.TrimSpace(expression), "default") {
			return condition.Target
		}
		if evaluateConditionExpression(expression, formData) {
			return condition.Target
		}
	}
	return config.DefaultTarget
}

func evaluateConditionExpression(expression string, formData json.RawMessage) bool {
	expression = strings.TrimSpace(expression)
	if expression == "" {
		return false
	}
	operators := []string{">=", "<=", "==", "!=", ">", "<"}
	for _, operator := range operators {
		parts := strings.SplitN(expression, operator, 2)
		if len(parts) != 2 {
			continue
		}
		left := strings.TrimSpace(strings.TrimPrefix(parts[0], "form."))
		right := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		value, ok := formValue(formData, left)
		if !ok {
			return false
		}
		return compareConditionValue(value, operator, right)
	}
	return false
}

func formValue(formData json.RawMessage, path string) (any, bool) {
	var data map[string]any
	if len(formData) == 0 || json.Unmarshal(formData, &data) != nil {
		return nil, false
	}
	var current any = data
	for _, part := range strings.Split(path, ".") {
		object, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		current, ok = object[part]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

func compareConditionValue(left any, operator string, right string) bool {
	leftNumber, leftNumberOK := asFloat(left)
	rightNumber, rightNumberOK := strconv.ParseFloat(right, 64)
	if leftNumberOK && rightNumberOK == nil {
		switch operator {
		case ">":
			return leftNumber > rightNumber
		case "<":
			return leftNumber < rightNumber
		case ">=":
			return leftNumber >= rightNumber
		case "<=":
			return leftNumber <= rightNumber
		case "==":
			return leftNumber == rightNumber
		case "!=":
			return leftNumber != rightNumber
		}
	}
	leftString := strings.TrimSpace(fmt.Sprint(left))
	switch operator {
	case "==":
		return leftString == right
	case "!=":
		return leftString != right
	}
	return false
}

func asFloat(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case string:
		number, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		return number, err == nil
	default:
		return 0, false
	}
}

func firstOutgoingTarget(graph workflowRuntimeGraph, key string) string {
	targets := graph.Outgoing[key]
	if len(targets) == 0 {
		return ""
	}
	return targets[0]
}

func cloneApprovalRuntimeNodes(nodes []approvalRuntimeNode) []approvalRuntimeNode {
	cloned := make([]approvalRuntimeNode, len(nodes))
	copy(cloned, nodes)
	return cloned
}

func mergeRuntimeNodeStatuses(base []approvalRuntimeNode, current []approvalRuntimeNode) []approvalRuntimeNode {
	next := cloneApprovalRuntimeNodes(base)
	statusByKey := make(map[string]string, len(current))
	for _, node := range current {
		statusByKey[node.Key] = node.Status
	}
	for index, node := range next {
		if status, ok := statusByKey[node.Key]; ok && status != "" {
			next[index].Status = status
		}
	}
	return next
}

func runtimeNodeIndex(nodes []approvalRuntimeNode, key string) (int, bool) {
	for index, node := range nodes {
		if node.Key == key {
			return index, true
		}
	}
	return -1, false
}
