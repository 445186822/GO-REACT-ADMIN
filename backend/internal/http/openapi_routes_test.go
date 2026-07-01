package http

import (
	"io"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"

	"enterprise-demo/backend/internal/config"
)

func TestOpenAPICoversRegisteredAPIRoutes(t *testing.T) {
	server := NewServer(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	documented := loadOpenAPIOperations(t, "../../api/openapi.yaml")

	missing := make([]string, 0)
	for _, route := range server.Routes() {
		if route.Method == http.MethodOptions || route.Method == "echo_route_not_found" {
			continue
		}
		path := route.Path
		if !strings.HasPrefix(path, "/api/v1/") {
			continue
		}
		path = strings.TrimPrefix(path, "/api/v1")
		path = echoPathToOpenAPI(path)
		key := strings.ToLower(route.Method) + " " + path
		if !documented[key] {
			missing = append(missing, key)
		}
	}
	sort.Strings(missing)
	if len(missing) > 0 {
		t.Fatalf("OpenAPI is missing registered routes:\n%s", strings.Join(missing, "\n"))
	}
}

func loadOpenAPIOperations(t *testing.T, path string) map[string]bool {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	operations := make(map[string]bool)
	var currentPath string
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "  /") && strings.HasSuffix(strings.TrimSpace(line), ":") {
			currentPath = strings.TrimSuffix(strings.TrimSpace(line), ":")
			continue
		}
		if currentPath == "" {
			continue
		}
		trimmed := strings.TrimSpace(line)
		switch trimmed {
		case "get:", "post:", "put:", "patch:", "delete:":
			operations[strings.TrimSuffix(trimmed, ":")+" "+currentPath] = true
		}
	}
	return operations
}

func echoPathToOpenAPI(path string) string {
	re := regexp.MustCompile(`:([A-Za-z_][A-Za-z0-9_]*)`)
	return re.ReplaceAllString(path, `{$1}`)
}
