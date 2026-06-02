---
name: Daily Memory Distillation
time: '23:00'
days: daily
active: 'true'
model: haiku
notify: on_failure
description: 'Extracts durable facts from daily log into MEMORY.md'
timeout: 5m
retry: '0'
---

Read today's `context/memory/{today}.md`. Extract any durable facts (URLs, decisions, preferences, project structure) that aren't already in `context/MEMORY.md`. Add them under the appropriate section (`## Active Threads`, `## Environment Notes`, `## Pending Decisions`). Enforce the 2,500 char cap — consolidate before adding if needed.
