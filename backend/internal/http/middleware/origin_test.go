package middleware

import "testing"

func TestOriginAllowedAcceptsConfiguredOrigin(t *testing.T) {
	if !OriginAllowed("https://admin.example.test", "api.example.test", "https://admin.example.test") {
		t.Fatal("configured origin was rejected")
	}
}

func TestOriginAllowedAcceptsSameHostOrigin(t *testing.T) {
	if !OriginAllowed("http://localhost:8080", "localhost:8080", "https://admin.example.test") {
		t.Fatal("same host origin was rejected")
	}
}

func TestOriginAllowedRejectsHostSubstringBypass(t *testing.T) {
	if OriginAllowed("https://localhost:8080.evil.example", "localhost:8080", "https://admin.example.test") {
		t.Fatal("substring origin bypass was accepted")
	}
}

func TestOriginAllowedAcceptsEmptyOriginForNonBrowserClients(t *testing.T) {
	if !OriginAllowed("", "localhost:8080", "https://admin.example.test") {
		t.Fatal("empty origin was rejected")
	}
}
