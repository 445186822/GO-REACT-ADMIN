package collaboration

import (
	"encoding/json"
	"fmt"
	"strings"
)

type workflowDefinitionSpec struct {
	Nodes []workflowDefinitionNode `json:"nodes"`
	Edges []workflowDefinitionEdge `json:"edges"`
}

type workflowDefinitionNode struct {
	ID   string                     `json:"id"`
	Key  string                     `json:"key"`
	Name string                     `json:"name"`
	Type string                     `json:"type"`
	Data workflowDefinitionNodeData `json:"data"`
}

type workflowDefinitionNodeData struct {
	Key         string          `json:"key"`
	Name        string          `json:"name"`
	NodeType    string          `json:"nodeType"`
	Assignee    string          `json:"assignee"`
	Description string          `json:"description"`
	Config      json.RawMessage `json:"config"`
}

type workflowDefinitionEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type executableWorkflowNode struct {
	Key      string
	Name     string
	NodeType string
	Assignee string
}

type approvalRuntimeStep struct {
	Name     string
	Assignee string
}

func executableWorkflowNodes(raw json.RawMessage) []executableWorkflowNode {
	var spec workflowDefinitionSpec
	if len(raw) == 0 || json.Unmarshal(raw, &spec) != nil {
		return defaultExecutableWorkflowNodes()
	}
	if len(spec.Nodes) == 0 {
		return defaultExecutableWorkflowNodes()
	}

	ordered := orderWorkflowDefinitionNodes(spec)
	result := make([]executableWorkflowNode, 0, len(ordered))
	for _, node := range ordered {
		result = append(result, node.executable())
	}
	return result
}

func approvalWorkflowNodes(raw json.RawMessage) []executableWorkflowNode {
	nodes := executableWorkflowNodes(raw)
	result := make([]executableWorkflowNode, 0)
	for _, node := range nodes {
		if node.NodeType == "approval" {
			result = append(result, node)
		}
	}
	return result
}

func workflowHasNotificationNode(raw json.RawMessage) bool {
	for _, node := range executableWorkflowNodes(raw) {
		if node.NodeType == "notification" {
			return true
		}
	}
	return false
}

func approvalRuntimeSteps(workflowDefinition json.RawMessage) []approvalRuntimeStep {
	nodes := approvalWorkflowNodes(workflowDefinition)
	steps := make([]approvalRuntimeStep, 0, len(nodes))
	for _, node := range nodes {
		steps = append(steps, approvalRuntimeStep{Name: node.Name, Assignee: node.Assignee})
	}
	return steps
}

func assigneeMatchesRoles(assignee string, roles []string) bool {
	labels := normalizeAssigneeLabels(assignee)
	if len(labels) == 0 {
		return true
	}
	roleSet := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		if normalized := normalizeAssigneeLabel(role); normalized != "" {
			roleSet[normalized] = struct{}{}
		}
	}
	for _, label := range labels {
		if _, ok := roleSet[label]; ok {
			return true
		}
	}
	return false
}

func normalizeAssigneeLabels(assignee string) []string {
	parts := strings.FieldsFunc(assignee, func(r rune) bool {
		return r == ',' || r == ';' || r == '，' || r == '；' || r == '|' || r == '/'
	})
	labels := make([]string, 0, len(parts))
	for _, part := range parts {
		if normalized := normalizeAssigneeLabel(part); normalized != "" {
			labels = append(labels, normalized)
		}
	}
	return labels
}

func normalizeAssigneeLabel(value string) string {
	value = strings.TrimSpace(strings.TrimPrefix(value, "role:"))
	return strings.ToLower(value)
}

func orderWorkflowDefinitionNodes(spec workflowDefinitionSpec) []workflowDefinitionNode {
	if len(spec.Edges) == 0 {
		return spec.Nodes
	}

	nodeByID := make(map[string]workflowDefinitionNode, len(spec.Nodes))
	incoming := make(map[string]int, len(spec.Nodes))
	outgoing := make(map[string][]string)
	nodeIDs := make([]string, 0, len(spec.Nodes))

	for index, node := range spec.Nodes {
		id := node.identity(index)
		nodeIDs = append(nodeIDs, id)
		nodeByID[id] = node
		incoming[id] = 0
	}
	for _, edge := range spec.Edges {
		if _, ok := nodeByID[edge.Source]; !ok {
			continue
		}
		if _, ok := nodeByID[edge.Target]; !ok {
			continue
		}
		outgoing[edge.Source] = append(outgoing[edge.Source], edge.Target)
		incoming[edge.Target]++
	}

	startIDs := make([]string, 0)
	for index, node := range spec.Nodes {
		if node.nodeType() == "start" {
			startIDs = append(startIDs, node.identity(index))
		}
	}
	for _, id := range nodeIDs {
		if incoming[id] == 0 && !containsString(startIDs, id) {
			startIDs = append(startIDs, id)
		}
	}
	if len(startIDs) == 0 {
		startIDs = append(startIDs, nodeIDs[0])
	}

	visited := make(map[string]bool, len(nodeIDs))
	ordered := make([]workflowDefinitionNode, 0, len(spec.Nodes))
	var visit func(string)
	visit = func(id string) {
		if visited[id] {
			return
		}
		node, ok := nodeByID[id]
		if !ok {
			return
		}
		visited[id] = true
		ordered = append(ordered, node)
		for _, targetID := range outgoing[id] {
			visit(targetID)
		}
	}

	for _, id := range startIDs {
		visit(id)
	}
	for _, id := range nodeIDs {
		visit(id)
	}
	return ordered
}

func (n workflowDefinitionNode) identity(index int) string {
	if n.ID != "" {
		return n.ID
	}
	if n.Key != "" {
		return n.Key
	}
	if n.Data.Key != "" {
		return n.Data.Key
	}
	return fmt.Sprintf("node_%d", index+1)
}

func (n workflowDefinitionNode) executable() executableWorkflowNode {
	key := firstNonEmpty(n.Data.Key, n.Key, n.ID)
	if key == "" {
		key = "node"
	}
	name := firstNonEmpty(n.Data.Name, n.Name, key)
	return executableWorkflowNode{Key: key, Name: name, NodeType: n.nodeType(), Assignee: n.Data.Assignee}
}

func (n workflowDefinitionNode) nodeType() string {
	return firstNonEmpty(n.Data.NodeType, n.Type, "action")
}

func workflowNodeRunMessage(node executableWorkflowNode) string {
	switch node.NodeType {
	case "start":
		return "Workflow started"
	case "end":
		return "Workflow completed"
	case "approval":
		return "Approval node completed"
	case "condition":
		return "Condition node evaluated"
	case "notification":
		return "Notification node completed"
	default:
		return "Workflow node completed"
	}
}

func defaultExecutableWorkflowNodes() []executableWorkflowNode {
	return []executableWorkflowNode{
		{Key: "start", Name: "Start", NodeType: "start"},
		{Key: "end", Name: "End", NodeType: "end"},
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
