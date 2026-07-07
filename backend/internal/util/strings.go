// Package util provides shared helper functions used across the backend.
package util

import "strings"

// TrimStringPtr trims whitespace from a *string and returns nil if the result is empty.
func TrimStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
