package collaboration

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type WorkflowBusinessTransition struct {
	WorkflowDefinitionID int64
	InstanceID           int64
	NodeKey              string
	Action               string
	AdapterCode          string
	BizType              string
	BizID                string
	WorkflowStatus       string
	BusinessStatus       string
	StatusDictCode       string
	ActorID              int64
}

type WorkflowBusinessAdapter interface {
	Code() string
	ApplyWorkflowTransition(ctx context.Context, tx pgx.Tx, transition WorkflowBusinessTransition) error
}

type BusinessAdapterRegistry struct {
	adapters map[string]WorkflowBusinessAdapter
}

func NewBusinessAdapterRegistry() *BusinessAdapterRegistry {
	return &BusinessAdapterRegistry{adapters: make(map[string]WorkflowBusinessAdapter)}
}

func (r *BusinessAdapterRegistry) Register(adapter WorkflowBusinessAdapter) {
	if adapter == nil {
		return
	}
	code := normalizeAdapterCode(adapter.Code())
	if code == "" {
		return
	}
	r.adapters[code] = adapter
}

func (r *BusinessAdapterRegistry) Apply(ctx context.Context, tx pgx.Tx, transition WorkflowBusinessTransition) (bool, error) {
	if strings.TrimSpace(transition.BusinessStatus) == "" {
		return false, nil
	}
	adapterCode := normalizeAdapterCode(transition.AdapterCode)
	if adapterCode == "" {
		return false, nil
	}
	adapter, ok := r.adapters[adapterCode]
	if !ok {
		return false, fmt.Errorf("workflow business adapter %q is not registered", transition.AdapterCode)
	}
	if err := adapter.ApplyWorkflowTransition(ctx, tx, transition); err != nil {
		return false, err
	}
	return true, nil
}

func normalizeAdapterCode(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

type customerWorkflowAdapter struct{}

func (customerWorkflowAdapter) Code() string {
	return "biz_customer"
}

func (customerWorkflowAdapter) ApplyWorkflowTransition(ctx context.Context, tx pgx.Tx, transition WorkflowBusinessTransition) error {
	if tx == nil {
		return fmt.Errorf("database transaction is required")
	}
	tag, err := tx.Exec(ctx, `
UPDATE biz_customers
SET status = $2, updated_at = now()
WHERE id::text = $1 AND deleted_at IS NULL`, transition.BizID, transition.BusinessStatus)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("business object %s/%s not found", transition.BizType, transition.BizID)
	}
	return nil
}

func defaultBusinessAdapterRegistry() *BusinessAdapterRegistry {
	registry := NewBusinessAdapterRegistry()
	registry.Register(customerWorkflowAdapter{})
	return registry
}
