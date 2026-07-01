package collaboration

import (
	"encoding/json"
	"testing"
)

func TestWorkflowBusinessMappingsFromDefinition(t *testing.T) {
	raw := json.RawMessage(`{
		"nodes": [
			{"id":"finance","type":"workflowNode","data":{"key":"finance_approval","nodeType":"approval","config":{"actions":[
				{"code":"APPROVE","instanceStatus":"APPROVED","businessStatus":"WAIT_PAY"},
				{"code":"REJECT","instanceStatus":"REJECTED","businessStatus":"FINANCE_REJECTED"}
			]}}},
			{"id":"end","type":"workflowNode","data":{"key":"end","nodeType":"end","config":{"finalStatus":"APPROVED","finalBusinessStatus":"PAID_APPROVED"}}}
		]
	}`)

	mappings := workflowBusinessMappingsFromDefinition(12, raw)

	if len(mappings) != 3 {
		t.Fatalf("len(mappings) = %d, want 3: %#v", len(mappings), mappings)
	}
	if mappings[0].NodeKey != "finance_approval" || mappings[0].ActionCode != "APPROVE" || mappings[0].WorkflowStatus != "APPROVED" || mappings[0].BusinessStatus != "WAIT_PAY" {
		t.Fatalf("unexpected approve mapping: %#v", mappings[0])
	}
	if mappings[2].NodeKey != "end" || mappings[2].ActionCode != "COMPLETE" || mappings[2].BusinessStatus != "PAID_APPROVED" {
		t.Fatalf("unexpected end mapping: %#v", mappings[2])
	}
}
