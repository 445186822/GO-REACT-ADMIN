# Backend

Go + Echo API service for Enterprise Demo.

## Commands

Normal local startup should use the repository script from the root:

```bash
enterprise-demo.bat start
enterprise-demo.bat status
enterprise-demo.bat stop
```

Backend-only commands:

```bash
copy .env.example .env
go mod tidy
go run ./cmd/api
go test ./...
```

The root script starts the backend on `http://127.0.0.1:18080`. A direct `go run ./cmd/api` uses the address from `HTTP_ADDR` or the backend default.

## Structure

```text
cmd/api                 API entrypoint
api/openapi.yaml        OpenAPI route documentation
internal/config         Environment configuration
internal/database       PostgreSQL connection, migrations, seed menus/settings
internal/http           Echo server, middleware, route permission mapping
internal/modules        Domain handlers
migrations              SQL migrations
```

## Environment

Runtime configuration is loaded from `backend/.env` when the backend is started from this directory.

Secrets belong in `.env`; documented defaults belong in `.env.example`.

Kafka/RabbitMQ settings are required only for the queue and IoT protocol lab pages.
