---
name: Nightly MemSearch Index
time: '02:00'
days: daily
active: 'true'
model: haiku
notify: on_failure
description: 'Re-indexes memory and transcript files for vector search'
timeout: 5m
retry: '1'
---

Run `memsearch index` to update the vector database with any new content from today's memory and transcript files.
