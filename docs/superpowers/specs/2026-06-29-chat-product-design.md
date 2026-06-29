# Chat Product Design

Date: 2026-06-29

## Goal

Upgrade `/collaboration/chat` from a basic message page into a complete internal IM product comparable to mainstream chat software, while staying within the existing monorepo, permission model, Ant Design UI stack, Echo API service, and PostgreSQL data model.

## Current State

The repository already contains an uncommitted chat module:

- Backend routes under `backend/internal/modules/chat/handler.go`.
- Tables in `backend/migrations/000016_chat.up.sql`.
- Frontend API helpers in `frontend/src/api/chat.ts`.
- Chat page and WebSocket hook in `frontend/src/features/chat/`.
- Menu and permission wiring for `chat:view`.

Known problems found during context exploration:

- The frontend clears user results when the new-chat search input is empty, even though the backend `GET /chat/users?keyword=` query already supports returning other active users.
- Creating a session reloads sessions and then reads from stale React state before falling back to a second fetch.
- The page mixes many responsibilities in one component: session list, message list, new-chat modal, AI helper, member state, message sending, and formatting.
- The current UI has partial IM behavior but lacks complete product interactions such as pinned conversations, muted conversations, member management, attachments, recall, read receipts, and robust failed-send states.
- Generated visual-companion files must remain ignored through `.superpowers/`.

## Scope

This implementation delivers the full C option requested by the user in one pass:

- One-to-one and group sessions.
- New chat modal that defaults to all other active users when no keyword is entered.
- Keyword user search by display name or username.
- Multi-select user picker for group creation.
- Session search in the left conversation list.
- Pinned sessions.
- Muted sessions.
- Session close/delete for the current user without deleting other participants' data.
- Conversation detail panel with members, session settings, shared files, and member management.
- Add and remove members for group sessions.
- Text, image, and generic file messages.
- Attachment upload through the existing file upload API where possible.
- Image preview.
- Message recall.
- Reply-to metadata support.
- Typing indicator.
- Unread counts.
- Read receipt state based on each participant's last read message.
- WebSocket real-time updates for message, typing, session update, member update, message recall, and read receipt events.
- Clear loading, empty, error, and retry states.
- Focused tests for backend chat helpers/handlers and frontend chat logic.

Out of scope for this pass:

- End-to-end encryption.
- Voice/video calls.
- Push notifications outside the active web app.
- Cross-device offline delivery guarantees beyond persisted database messages.
- Advanced message search across all history.
- Rich text editor formatting beyond plain text, emoji, attachments, and reply metadata.

## Architecture

The chat system remains a first-party module, not a separate service. Backend changes extend the existing `chat` module and migration set. Frontend changes keep the route at `/collaboration/chat`, use existing auth and API helpers, and split the large page into focused local components and pure utility functions.

The module boundaries are:

- Backend handler: HTTP and WebSocket protocol, auth checks, response shaping.
- Backend repository/helper functions: participant checks, session summary, read state, message mutation rules.
- Frontend API layer: typed REST calls.
- Frontend WebSocket hook: connection lifecycle and typed event dispatch.
- Frontend chat components: session list, message pane, composer, new-chat modal, detail panel.
- Frontend pure utilities: session filtering/sorting, user selection, message display state.

## Data Model

Extend `chat_participants`:

- `is_pinned BOOLEAN NOT NULL DEFAULT false`
- `muted BOOLEAN NOT NULL DEFAULT false`
- `last_read_message_id BIGINT NULL REFERENCES chat_messages(id)`
- `removed_at TIMESTAMPTZ NULL`

Extend `chat_messages`:

- `status TEXT NOT NULL DEFAULT 'SENT'`
- `revoked_at TIMESTAMPTZ NULL`
- `revoked_by BIGINT NULL REFERENCES sys_users(id)`
- `reply_to_id BIGINT NULL REFERENCES chat_messages(id)`
- `file_name TEXT NOT NULL DEFAULT ''`
- `file_size BIGINT NOT NULL DEFAULT 0`
- `mime_type TEXT NOT NULL DEFAULT ''`

Message type values:

- `SYSTEM`
- `TEXT`
- `IMAGE`
- `FILE`

Message status values:

- `SENT`
- `REVOKED`

Session visibility rules:

- A user sees active sessions where they have a `chat_participants` row with `removed_at IS NULL`.
- Closing/deleting a session from the UI sets only that user's `removed_at`, unless the product later adds administrator-owned hard delete.
- A session remains available to other participants.

Read state rules:

- Opening a session updates the current user's `last_read_at` and `last_read_message_id` to the latest visible message in that session.
- Unread count counts non-system, non-revoked messages from other users after the participant's `last_read_message_id` or `last_read_at` fallback.
- Read receipts for the current user's message are derived from other active participants whose `last_read_message_id >= message.id`.

## Backend API

All routes remain under `/api/v1` and require the existing auth and permission middleware unless explicitly noted.

Existing routes to keep and enhance:

- `GET /chat/sessions`
  - Returns sessions visible to the current user.
  - Adds participant settings, pinned/muted flags, participant count, last message, unread count, and read summary.
  - Sorts pinned sessions first, then by `updated_at DESC`.

- `POST /chat/sessions`
  - Creates a one-to-one or group session.
  - Deduplicates participant IDs and always includes current user.
  - Rejects empty participant lists and inactive/deleted users.
  - Creates a system message.
  - Broadcasts `session_new` to participants.

- `GET /chat/sessions/:id/messages`
  - Returns chronological paged messages.
  - Includes attachment metadata, status, recall metadata, and reply preview.

- `POST /chat/sessions/:id/messages`
  - Sends `TEXT`, `IMAGE`, or `FILE`.
  - Validates membership, non-empty content or attachment URL, and message type.
  - Broadcasts `message`.

- `PUT /chat/sessions/:id/read`
  - Marks the session read for current user.
  - Updates `last_read_at` and `last_read_message_id`.
  - Broadcasts `read_receipt`.

- `PUT /chat/sessions/:id`
  - Updates session title for participants.
  - Keeps status handling only for server-owned active/closed state if needed.

New routes:

- `GET /chat/users?keyword=`
  - Returns up to 100 active users excluding current user when keyword is empty.
  - Filters by display name or username when keyword is present.

- `GET /chat/sessions/:id`
  - Returns detail for a session: title, participants, current user's pinned/muted state, shared attachments, and read summary.

- `PUT /chat/sessions/:id/settings`
  - Body: `{ "is_pinned"?: boolean, "muted"?: boolean }`
  - Updates current user's participant settings only.
  - Broadcasts `session_updated` to current user's clients.

- `POST /chat/sessions/:id/participants`
  - Body: `{ "user_ids": number[] }`
  - Adds active users to a group session.
  - Writes a system message.
  - Broadcasts `participants_updated` and `session_new` for new members.

- `DELETE /chat/sessions/:id/participants/:user_id`
  - Removes a participant by setting `removed_at`.
  - Allows current user to leave a group.
  - Allows session creator to remove another participant.
  - Prevents removing the last active participant.
  - Writes a system message and broadcasts `participants_updated`.

- `POST /chat/sessions/:id/messages/:message_id/revoke`
  - Allows sender to revoke a non-system message within a practical time window of two minutes.
  - Sets `status='REVOKED'`, `revoked_at`, and `revoked_by`.
  - Broadcasts `message_revoked`.

## WebSocket Protocol

Client-to-server events:

- `{ "type": "join", "session_id": number }`
- `{ "type": "leave", "session_id": number }`
- `{ "type": "msg", "session_id": number, "content": string, "message_type": "TEXT" | "IMAGE" | "FILE", "attachment_url"?: string, "file_name"?: string, "file_size"?: number, "mime_type"?: string, "reply_to_id"?: number }`
- `{ "type": "typing", "session_id": number }`
- `{ "type": "read", "session_id": number, "message_id": number }`

Server-to-client events:

- `message`
- `session_new`
- `session_updated`
- `participants_updated`
- `message_revoked`
- `typing`
- `read_receipt`
- `error`

The server must verify participant access for every event that includes a `session_id`.

## Frontend UX

Main layout:

- Left column: searchable session list with unread badges, pinned state, muted icon, last message, and timestamp.
- Center column: active conversation header, message stream, typing indicator, composer, attachment controls, emoji picker, and send/retry states.
- Right column: collapsible conversation detail panel with members, settings, and shared files.

New chat modal:

- Opens by immediately loading `GET /chat/users?keyword=`.
- Shows all other active users when the search field is empty.
- Filters results as the user types.
- Supports multi-select.
- Shows selected users as removable tags.
- Creates a direct session for one selected user and a group session for multiple selected users.
- After creation, refreshes sessions from the returned list and selects the newly created session without relying on stale React state.

Session list behavior:

- Local search filters by title, participant names, and last message content.
- Pinned sessions stay above unpinned sessions.
- Muted sessions still receive messages but suppress prominent unread styling.
- Empty state offers "New chat".

Message behavior:

- Text messages preserve line breaks.
- Image messages render thumbnails and support preview.
- File messages show filename, size, and download link.
- Revoked messages render as a neutral recall notice.
- Failed optimistic messages show a retry action.
- Current user's sent messages show read state when available.
- Users can revoke their own recent messages from a message action menu.
- Typing indicator appears in the message area and clears automatically after a short timeout.

Detail panel behavior:

- Shows member list with avatars.
- Supports add member.
- Supports leave group.
- Allows session creator to remove members.
- Supports title edit.
- Supports pinned and muted toggles for current user.
- Lists shared image/file messages.

## Error Handling

Backend:

- Return `400 VALIDATION_ERROR` for malformed IDs, empty content, inactive users, invalid message type, and invalid participant changes.
- Return `403 FORBIDDEN` for non-participants, unauthorized member removal, or revoke attempts by non-senders.
- Return `404 RESOURCE_NOT_FOUND` for missing sessions/messages/users.

Frontend:

- Surface API failures with Ant Design `message.error`.
- Keep optimistic outgoing messages visible when sending fails and allow retry.
- Disable duplicate create/send actions while requests are pending.
- Show empty states for no sessions, no messages, no users, and no shared files.

## Testing

Backend:

- Add focused tests around pure helper functions where possible: participant deduplication, session title generation, unread/read receipt derivation, revoke eligibility, and user search limit behavior.
- Add handler-level tests where the existing test setup permits practical HTTP testing without a full external database.
- Run `go test ./...`.

Frontend:

- Add pure utility tests for:
  - Empty keyword user search should call the API and show returned users.
  - Session sorting pins pinned sessions first.
  - Session search matches participant names and last message content.
  - Multi-select toggles users without duplicates.
  - Revoked messages and file/image messages derive correct display state.
- Run `npm run build`.

## Implementation Notes

- Keep planned modules that are unrelated to chat out of routes, menus, seed data, and OpenAPI unless already fully implemented.
- Use existing Ant Design components and local store patterns.
- Keep API helpers in `frontend/src/api/chat.ts`.
- Prefer splitting the current `ChatPage.tsx` into focused components under `frontend/src/features/chat/components/` and utilities under `frontend/src/features/chat/chatUtils.ts`.
- Use `gofmt` for Go changes.
- Do not commit real `.env` files, uploads, build outputs, or `.superpowers/` generated companion files.
