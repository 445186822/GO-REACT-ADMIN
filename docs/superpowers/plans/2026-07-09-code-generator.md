# Quick Code Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a "快速生成代码" business menu that previews and generates CRUD source files for whitelisted `biz_` database tables.

**Architecture:** Add a focused backend `codegen` module for metadata introspection, preview generation, and safe file writes. Add a frontend page that mirrors the customer-management style: table selection, metadata form, generated-file preview, and confirmation. Register routes, menu permissions, and OpenAPI entries using existing monorepo patterns.

**Tech Stack:** Go + Echo + pgx, PostgreSQL `information_schema`, React + Vite + TypeScript, Ant Design ProComponents, Vitest/source safeguards, Go package tests.

---

### Task 1: Backend Metadata And Safety

**Files:**
- Create: `backend/internal/modules/codegen/handler.go`
- Create: `backend/internal/modules/codegen/codegen_test.go`
- Modify: `backend/internal/http/middleware/route_permissions.go`

- [ ] **Step 1: Write failing backend tests**

Create tests for `isAllowedBusinessTable`, `normalizeModuleName`, type mapping, and preview path generation.

- [ ] **Step 2: Run failing tests**

Run: `cd backend && go test ./internal/modules/codegen`
Expected: FAIL because the package does not exist or functions are undefined.

- [ ] **Step 3: Implement metadata helpers**

Implement whitelisted table validation, identifier validation, module naming helpers, PostgreSQL-to-form type mapping, and preview file path generation.

- [ ] **Step 4: Implement handlers**

Expose `GET /code-generator/tables`, `GET /code-generator/tables/:table/columns`, `POST /code-generator/preview`, and `POST /code-generator/generate`.

- [ ] **Step 5: Run backend tests**

Run: `cd backend && go test ./internal/modules/codegen ./internal/http/middleware`
Expected: PASS.

### Task 2: Backend Registration And Contracts

**Files:**
- Modify: `backend/internal/http/server.go`
- Modify: `backend/api/openapi.yaml`
- Modify: `backend/internal/database/database.go`
- Modify: `backend/internal/database/migrations_test.go`
- Create: `backend/migrations/000027_code_generator_menu.up.sql`
- Create: `backend/migrations/000027_code_generator_menu.down.sql`

- [ ] **Step 1: Write failing registration tests**

Add source-level assertions that the menu seed includes `code-generator:view`, `code-generator:create`, and `/business/code-generator`.

- [ ] **Step 2: Register module and permissions**

Register `codegen.NewHandler(db, cfg.JWTSecret)` in `server.go`, map permissions in `route_permissions.go`, add OpenAPI paths, and add seed/migration menu data.

- [ ] **Step 3: Run backend full tests**

Run: `cd backend && go test ./...`
Expected: PASS.

### Task 3: Frontend API And Page

**Files:**
- Create: `frontend/src/api/codeGenerator.ts`
- Create: `frontend/src/features/codegen/pages/CodeGeneratorPage.tsx`
- Create: `frontend/src/features/codegen/codeGeneratorPage.test.ts`
- Modify: `frontend/src/routes/lazyRoutes.ts`
- Modify: `frontend/src/routes/lazyRoutes.test.ts`

- [ ] **Step 1: Write failing frontend tests**

Assert route registration, page table selector, preview action, generate action, and lack of free-form system table entry.

- [ ] **Step 2: Implement API wrapper**

Add typed functions for table list, column list, preview, and generate.

- [ ] **Step 3: Implement page**

Build an Ant Design ProComponents page with table selector, metadata form, column preview table, generated file preview tabs, and confirmation modal.

- [ ] **Step 4: Run frontend tests/build**

Run: `cd frontend && npm test -- src/features/codegen/codeGeneratorPage.test.ts src/routes/lazyRoutes.test.ts`
Run: `cd frontend && npm run build`
Expected: PASS.

### Task 4: Final Verification

**Files:**
- All touched files.

- [ ] **Step 1: Format**

Run: `cd backend && gofmt -w internal/modules/codegen internal/http/server.go internal/http/middleware/route_permissions.go internal/database/database.go`

- [ ] **Step 2: Verify backend**

Run: `cd backend && go test ./...`
Expected: PASS.

- [ ] **Step 3: Verify frontend**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 4: Diff check**

Run: `git diff --check`
Expected: no output.
