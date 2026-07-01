package collaboration

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
)

type recordingBusinessAdapter struct {
	code       string
	received   WorkflowBusinessTransition
	callCount  int
	shouldFail error
}

func (a *recordingBusinessAdapter) Code() string {
	return a.code
}

func (a *recordingBusinessAdapter) ApplyWorkflowTransition(ctx context.Context, tx pgx.Tx, transition WorkflowBusinessTransition) error {
	a.callCount++
	a.received = transition
	return a.shouldFail
}

func TestBusinessAdapterRegistryAppliesRegisteredAdapter(t *testing.T) {
	adapter := &recordingBusinessAdapter{code: "expense_claim"}
	registry := NewBusinessAdapterRegistry()
	registry.Register(adapter)

	transition := WorkflowBusinessTransition{
		AdapterCode:    "expense_claim",
		BizType:        "expense_claim",
		BizID:          "EXP-1",
		BusinessStatus: "WAIT_PAY",
	}
	applied, err := registry.Apply(context.Background(), nil, transition)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	if !applied {
		t.Fatal("Apply returned applied=false")
	}
	if adapter.callCount != 1 {
		t.Fatalf("adapter callCount = %d, want 1", adapter.callCount)
	}
	if adapter.received.BusinessStatus != "WAIT_PAY" {
		t.Fatalf("BusinessStatus = %q, want WAIT_PAY", adapter.received.BusinessStatus)
	}
}

func TestBusinessAdapterRegistryRejectsUnknownConfiguredAdapter(t *testing.T) {
	registry := NewBusinessAdapterRegistry()

	_, err := registry.Apply(context.Background(), nil, WorkflowBusinessTransition{
		AdapterCode:    "unknown_adapter",
		BizType:        "expense_claim",
		BizID:          "EXP-1",
		BusinessStatus: "WAIT_PAY",
	})
	if err == nil {
		t.Fatal("Apply accepted unknown configured adapter")
	}
}

func TestBusinessAdapterRegistrySkipsEmptyBusinessStatus(t *testing.T) {
	registry := NewBusinessAdapterRegistry()

	applied, err := registry.Apply(context.Background(), nil, WorkflowBusinessTransition{
		AdapterCode: "expense_claim",
		BizType:     "expense_claim",
		BizID:       "EXP-1",
	})
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	if applied {
		t.Fatal("Apply returned applied=true for empty business status")
	}
}
