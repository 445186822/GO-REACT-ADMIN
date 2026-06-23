# Backend

Go + Echo API service for Enterprise Demo.

## Commands

```bash
copy .env.example .env
go mod tidy
go run ./cmd/api
go test ./...
```

## Structure

```text
cmd/api
internal/config
internal/http
internal/modules
migrations
api/openapi.yaml
```

## Environment

Runtime configuration is loaded from `backend/.env` when the backend is started from this directory. For compatibility with older local setups, the loader also reads `../.env` if present.
