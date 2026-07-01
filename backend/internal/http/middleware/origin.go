package middleware

import (
	"net/url"
	"strings"
)

func OriginAllowed(origin string, requestHost string, allowedOrigin string) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return true
	}
	allowedOrigin = strings.TrimSpace(allowedOrigin)
	if allowedOrigin == "*" || strings.EqualFold(origin, allowedOrigin) {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return strings.EqualFold(parsed.Host, requestHost)
}
