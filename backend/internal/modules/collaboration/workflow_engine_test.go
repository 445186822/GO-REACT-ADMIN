package collaboration

import (
	"encoding/json"
	"testing"
)

func TestExecutableWorkflowNodesUsesReactFlowEdges(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"n_start","type":"workflowNode","data":{"key":"start","name":"Submit leave","nodeType":"start"}},
			{"id":"n_hr","type":"workflowNode","data":{"key":"hr_confirm","name":"HR confirm","nodeType":"approval"}},
			{"id":"n_dept","type":"workflowNode","data":{"key":"dept_approval","name":"Department approval","nodeType":"approval"}},
			{"id":"n_end","type":"workflowNode","data":{"key":"end","name":"Archive","nodeType":"end"}}
		],
		"edges": [
			{"source":"n_start","target":"n_dept"},
			{"source":"n_dept","target":"n_hr"},
			{"source":"n_hr","target":"n_end"}
		]
	}`)

	nodes := executableWorkflowNodes(raw)
	assertWorkflowKeys(t, nodes, []string{"start", "dept_approval", "hr_confirm", "end"})
}

func TestExecutableWorkflowNodesChangesWhenEdgesChange(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"n_start","type":"workflowNode","data":{"key":"start","name":"Submit leave","nodeType":"start"}},
			{"id":"n_dept","type":"workflowNode","data":{"key":"dept_approval","name":"Department approval","nodeType":"approval"}},
			{"id":"n_manager","type":"workflowNode","data":{"key":"manager_approval","name":"Manager approval","nodeType":"approval"}},
			{"id":"n_hr","type":"workflowNode","data":{"key":"hr_confirm","name":"HR confirm","nodeType":"approval"}},
			{"id":"n_end","type":"workflowNode","data":{"key":"end","name":"Archive","nodeType":"end"}}
		],
		"edges": [
			{"source":"n_start","target":"n_dept"},
			{"source":"n_dept","target":"n_manager"},
			{"source":"n_manager","target":"n_hr"},
			{"source":"n_hr","target":"n_end"}
		]
	}`)

	nodes := executableWorkflowNodes(raw)
	assertWorkflowKeys(t, nodes, []string{"start", "dept_approval", "manager_approval", "hr_confirm", "end"})
}

func TestExecutableWorkflowNodesSupportsLegacyNodes(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"key":"start","name":"Submit leave","type":"start"},
			{"key":"dept_approval","name":"Department approval","type":"approval"},
			{"key":"hr_confirm","name":"HR confirm","type":"approval"},
			{"key":"end","name":"Archive","type":"end"}
		]
	}`)

	nodes := executableWorkflowNodes(raw)
	assertWorkflowKeys(t, nodes, []string{"start", "dept_approval", "hr_confirm", "end"})
}

func assertWorkflowKeys(t *testing.T, nodes []executableWorkflowNode, want []string) {
	t.Helper()
	if len(nodes) != len(want) {
		t.Fatalf("node count = %d, want %d: %#v", len(nodes), len(want), nodes)
	}
	for index, key := range want {
		if nodes[index].Key != key {
			t.Fatalf("node[%d].Key = %q, want %q: %#v", index, nodes[index].Key, key, nodes)
		}
	}
}
