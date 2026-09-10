---
name: memory-recall
description: >
  Searches past session memory semantically when a question needs history the
  current context does not hold — "what did we decide about X", "why did we do
  Y that way", "have we hit this bug before", "where did we leave Z". Runs
  search and expansion in a forked context and returns only the findings, so
  retrieval never spends main-context tokens. Skip for questions about current
  code state, which the repo itself answers.
context: fork
agent: Explore
background: false
allowed-tools: Bash
---

# Memory Recall

Retrieve from the memsearch index over `context/memory/`, `context/external/`,
and `context/transcripts/`. You are running in a fork: nothing you read here
reaches the main conversation except what you return, so read freely and return
tightly.

## Steps

1. **Search.** Run the query the caller gave you:

   ```bash
   memsearch search "<query>" --top-k 5
   ```

   Ask for JSON with `-j` only if you need `chunk_hash` values for step 3.
   Add `--source-prefix context/memory` to exclude external docs and
   transcripts when the question is clearly about past sessions.

2. **Judge relevance before expanding.** Scores are cosine similarity; in
   practice anything under ~0.35 is noise. Two strong hits beat five weak ones.
   If nothing clears the bar, say so — a wrong recalled "decision" is worse
   than none.

3. **Expand only what you will cite.** Each result carries a `chunk_hash`:

   ```bash
   memsearch expand <chunk_hash>
   ```

   This returns the full heading section around the chunk, which is usually
   where the reasoning lives — search returns the sentence, `expand` returns
   the decision behind it.

4. **Return.** Answer the question directly, with the source file and date for
   each claim (`context/memory/2026-07-29.md`). Date matters: memory records
   what was true when written, and this repo moves. Flag anything that reads as
   stale or since-superseded rather than presenting it as current.

## Failure modes

- **`DataDirLockedError`** — another process holds the Milvus Lite store
  (a stray `memsearch watch`, or a concurrent index). Report that; do not retry
  in a loop.
- **`OpenAIError: Missing credentials`** — the embedding provider has fallen
  back to OpenAI. The fix is `memsearch config set embedding.provider onnx`;
  report it rather than working around it, and never set an API key to get past
  it — that would send this repo's private memory to a third party and embed it
  with a model the index was not built with.
- **Empty index** — `memsearch stats` reporting 0 chunks means nothing has been
  indexed. Say so; the fix is `scripts/memsearch-index.sh`.
