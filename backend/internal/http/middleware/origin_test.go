package middleware

import "testing"

func TestOriginAllowedAcceptsConfiguredOrigin(t *testing.T) {
	if !OriginAllowed("https://admin.example.test", "api.example.test", "https://admin.example.test") {
		t.Fatal("configured origin was rejected")
	}
}

func TestOriginAllowedAcceptsOneOfConfiguredOrigins(t *testing.T) {
	if !OriginAllowed("http://localhost:15173", "127.0.0.1:18080", "http://127.0.0.1:15173, http://localhost:15173") {
		t.Fatal("configured localhost origin was rejected")
	}
}

func TestOriginAllowedAcceptsLoopbackAliasOnSamePort(t *testing.T) {
	if !OriginAllowed("http://localhost:15173", "127.0.0.1:18080", "http://127.0.0.1:15173") {
		t.Fatal("loopback alias origin on same port was rejected")
	}
}

func TestOriginAllowedRejectsLoopbackAliasOnDifferentPort(t *testing.T) {
	if OriginAllowed("http://localhost:5173", "127.0.0.1:18080", "http://127.0.0.1:15173") {
		t.Fatal("loopback alias origin on different port was accepted")
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
