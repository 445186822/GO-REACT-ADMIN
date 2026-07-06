# Technical Debt

This file replaces the old root-level `待优化.txt`. It keeps only current, actionable cleanup items and removes historical review transcripts.

## High Priority

- Split `frontend/src/layouts/BasicLayout.tsx` into smaller units:
  - layout shell
  - appearance drawer
  - tab navigation hook
  - menu helper functions
- Review WebSocket lifecycle:
  - notification badge and notification center should share connection behavior where practical
  - chat WebSocket should keep reconnect and error states visible
- Add explicit WebSocket origin checks and proxy support review for local and deployed environments.
- Continue tightening permission granularity where broad permissions remain.

## Medium Priority

- Add richer dashboard charts only after choosing a chart library and confirming real backend data needs.
- Add upload progress and preview affordances to file management.
- Improve knowledge base editing with a proper Markdown or rich-text editor.
- Add skeleton/loading states to heavy pages such as approval and workflow screens.
- Review large list exports and move high-volume exports to backend streaming endpoints.

## Low Priority

- Add visible WebSocket connection status where it helps users diagnose real-time pages.
- Add more focused component extraction in workflow and chat pages as they evolve.
- Add optional cron presets and validation improvements to scheduler forms.

## Recently Addressed

- Dashboard now uses backend statistics.
- Error boundary is present in the main layout.
- Queue and IoT protocol labs are implemented for Kafka, RabbitMQ, TCP, UDP, and MQTT.
- Kafka IoT publishing confirms or creates topics before writing.
- RabbitMQ publishing declares queues before writing.
- Chat is implemented as a real route with backend APIs, database tables, and WebSocket behavior.
