# Chat Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved full internal IM experience for `/collaboration/chat`.

**Architecture:** Extend the existing first-party chat module instead of adding a separate service. Keep backend behavior in `backend/internal/modules/chat`, keep typed frontend API calls in `frontend/src/api/chat.ts`, and split the large chat page into focused utilities/components where it reduces risk.

**Tech Stack:** Go 1.22, Echo, pgx, PostgreSQL migrations, React 19, Vite, TypeScript, Ant Design, Vitest, WebSocket.

---

## File Structure

- Modify `backend/migrations/000016_chat.up.sql` and `backend/migrations/000016_chat.down.sql` to include full chat fields.
- Modify `backend/internal/modules/chat/handler.go` for API, WebSocket, access checks, read receipts, participants, settings, recall, and attachment metadata.
- Create `backend/internal/modules/chat/chat_helpers.go` for pure helper logic that can be tested without a database.
- Create `backend/internal/modules/chat/chat_helpers_test.go` for backend TDD coverage.
- Modify `frontend/src/api/chat.ts` to expose typed chat detail, settings, participants, recall, and attachment APIs.
- Create `frontend/src/features/chat/chatUtils.ts` for pure sorting, filtering, selection, and display helpers.
- Create `frontend/src/features/chat/chatUtils.test.ts` for frontend TDD coverage.
- Modify `frontend/src/features/chat/hooks/useChatWebSocket.ts` for new typed events.
- Modify `frontend/src/features/chat/pages/ChatPage.tsx` and `frontend/src/features/chat/pages/chat.css` for full IM UI behavior.

No git commits will be made unless the user explicitly requests them.

## Tasks

### Task 1: Frontend Pure Chat Behavior

**Files:**
- Create: `frontend/src/features/chat/chatUtils.test.ts`
- Create: `frontend/src/features/chat/chatUtils.ts`
- Modify: `frontend/src/api/chat.ts`

- [ ] Write failing Vitest tests for pinned sorting, session search, user toggle dedupe, message display state, and empty-keyword user loading assumptions.
- [ ] Run `cd frontend && npm test -- src/features/chat/chatUtils.test.ts` and verify the tests fail because utilities do not exist.
- [ ] Implement minimal utility functions and API types.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Backend Pure Chat Rules

**Files:**
- Create: `backend/internal/modules/chat/chat_helpers_test.go`
- Create: `backend/internal/modules/chat/chat_helpers.go`

- [ ] Write failing Go tests for participant dedupe, generated title, revoke eligibility, unread/read receipt derivation, and user-search limit constants.
- [ ] Run `cd backend && go test ./internal/modules/chat` and verify tests fail because helpers do not exist.
- [ ] Implement minimal helper functions.
- [ ] Re-run the focused Go test and verify it passes.

### Task 3: Backend Schema and API

**Files:**
- Modify: `backend/migrations/000016_chat.up.sql`
- Modify: `backend/migrations/000016_chat.down.sql`
- Modify: `backend/internal/modules/chat/handler.go`

- [ ] Extend migrations with participant settings, removed state, message status, revoke metadata, reply metadata, and file metadata.
- [ ] Enhance session list/detail queries to include pinned, muted, participant counts, shared attachments, and active participants only.
- [ ] Implement settings, detail, participant add/remove, recall, richer message send, and read receipt endpoints.
- [ ] Extend WebSocket message structs and dispatch for typing, read, message revoke, participant updates, and richer message payloads.
- [ ] Run `cd backend && gofmt -w internal/modules/chat migrations` where applicable, then `go test ./...`.

### Task 4: Frontend Full Chat UI

**Files:**
- Modify: `frontend/src/api/chat.ts`
- Modify: `frontend/src/features/chat/hooks/useChatWebSocket.ts`
- Modify: `frontend/src/features/chat/pages/ChatPage.tsx`
- Modify: `frontend/src/features/chat/pages/chat.css`

- [ ] Open new chat modal by loading all other active users with empty keyword.
- [ ] Add session search, pinned/muted display and settings, participant detail panel, add/remove members, leave conversation, and title edit.
- [ ] Add attachment selection through existing upload API helpers or direct multipart request if no helper fits.
- [ ] Add text/image/file bubbles, image preview, message recall action, retryable failed-send state, typing indicator, and read receipt display.
- [ ] Keep AI helper behavior working unless it conflicts with the chat layout; if it conflicts, keep it behind a compact side panel toggle.
- [ ] Run focused frontend tests and `npm run build`.

### Task 5: Runtime Verification

**Files:**
- No new files expected.

- [ ] Run `cd backend && go test ./...`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Start the frontend dev server if needed and report the local URL.
- [ ] Summarize changed files and any verification failures without committing.
