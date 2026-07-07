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
	for _, allowed := range strings.Split(allowedOrigin, ",") {
		allowed = strings.TrimSpace(allowed)
		if allowed == "*" || strings.EqualFold(origin, allowed) {
			return true
		}
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	for _, allowed := range strings.Split(allowedOrigin, ",") {
		allowed = strings.TrimSpace(allowed)
		allowedURL, err := url.Parse(allowed)
		if err == nil && sameLoopbackOrigin(parsed, allowedURL) {
			return true
		}
	}
	return strings.EqualFold(parsed.Host, requestHost)
}

func sameLoopbackOrigin(origin *url.URL, allowed *url.URL) bool {
	return strings.EqualFold(origin.Scheme, allowed.Scheme) &&
		origin.Port() == allowed.Port() &&
		isLoopbackHost(origin.Hostname()) &&
		isLoopbackHost(allowed.Hostname())
}

func isLoopbackHost(host string) bool {
	host = strings.Trim(strings.ToLower(host), "[]")
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}
