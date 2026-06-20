# Memory System Setup Guide

Reusable implementation guide for adding Store / Inject / Recall memory to any Claude Code project.

**What you get:**
- **Store** — transcript capture after every response + curated fact scratchpad Claude writes on demand
- **Inject** — frozen snapshot of user profile, working memory, and today's daily log loaded silently at session start (~3,000 tokens)
- **Recall** — four-tier retrieval: context (free) → hybrid vector+keyword search → chunk expansion → raw transcript

**Works in remote / ephemeral containers** (Claude Code on the web, GitHub Actions, CI) because all memory files are git-tracked. The container resets between sessions but the memory persists in the repo.

---

## Prerequisites

```bash
pip install 'memsearch[onnx]'
# On externally-managed Python (Homebrew, modern Debian/Ubuntu — PEP 668),
# pip refuses a system-wide install. Use pipx so `memsearch` lands on PATH:
#   brew install pipx && pipx ensurepath
#   pipx install 'memsearch[onnx]'
# memsearch[onnx] installs onnxruntime + tokenizers for local CPU embedding.
# First index run downloads gpahal/bge-m3-onnx-int8 (~558 MB) from HuggingFace,
# cached at ~/.cache/huggingface/hub/ — no API key, fully offline after that.
```

Node.js is required for the transcript capture hook (any version ≥ 16).

---

## Step 1 — Folder structure

```bash
mkdir -p context/memory context/transcripts context/external
touch context/memory/.gitkeep   # so git tracks the empty directory
touch context/external/.gitkeep
```

| Directory | Git-tracked | Purpose |
|-----------|-------------|---------|
| `context/memory/` | ✅ Yes | Daily session logs — shared across the team |
| `context/external/` | ✅ Yes | Markdown exports from Notion/Confluence/local docs — shared |
| `context/transcripts/` | ❌ Gitignored | Machine-local transcript captures |

---

## Step 2 — context/MEMORY.md

Create only if missing — it may already contain curated facts from previous sessions:

```markdown
<!-- Cap: 2,500 chars. Agent maintains via memory-write instructions. -->
# Working Memory

## Active Threads

## Environment Notes

## Pending Decisions
```

---

## Step 3 — context/USER.md

Create only if missing:

```markdown
<!-- Cap: 1,375 chars. Updated by the agent when it learns preferences. -->
# User Profile

## About

## Preferences

## Working Style
```

---

## Step 4 — Transcript capture hook

Create `.claude/hooks/transcript-capture.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Stop hook: appends first 500 chars of each response to today's transcript file.
const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));

if (input.stop_reason === 'end_turn' && input.response) {
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(process.env.CLAUDE_PROJECT_DIR || '.', 'context', 'transcripts');
  const file = path.join(dir, `${today}.md`);

  try {
    fs.mkdirSync(dir, { recursive: true });
    const summary = input.response.slice(0, 500).replace(/\n{3,}/g, '\n\n');
    const timestamp = new Date().toISOString().slice(11, 19);
    fs.appendFileSync(file, `\n## ${timestamp}\n${summary}\n`);
  } catch (e) {
    // Fire and forget — don't break the session
  }
}
```

Register it in `.claude/settings.json`. Merge with existing content — do not replace the whole file:

```json
{
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/hooks/transcript-capture.js"
        }
      ]
    }
  ]
}
```

If the file already has a `Stop` array, append the hook object to it. If the file uses a `"hooks": { "Stop": [...] }` wrapper instead of top-level keys, use that same format.

---

## Step 5 — CLAUDE.md memory sections

Read `CLAUDE.md` first. Skip any section that already exists. Add only what is missing.

### Session Startup

```markdown
## Session Startup (silent — do not output anything)

On every session start, read these files silently:
1. Read `context/USER.md` (~1.4 KB max)
2. Read `context/MEMORY.md` (~2.5 KB max, curated working scratchpad)
3. Read `context/memory/{today's date in YYYY-MM-DD}.md` if it exists
4. If today's memory file has no prior sessions, also read yesterday's

These files are your "frozen snapshot" — loaded once at session start. Mid-session writes
persist to disk but take effect next session. This preserves the prefix cache.

Total injected: ~3,000 tokens. Do not load more than this at startup.
```

### Memory Budget

```markdown
### Memory Budget

- `context/MEMORY.md`: 2,500 character cap. Before writing, check `wc -c`. If over cap, consolidate existing entries before adding.
- `context/USER.md`: 1,375 character cap. Same rule.
- Mid-session writes to these files persist to disk but only appear in context next session (frozen snapshot pattern — preserves prefix cache).
```

### Memory Write

```markdown
### Memory Write

When the user says "remember this", "note that", "update memory", or "forget about":
1. Read `context/MEMORY.md` in full
2. Check for duplicates (scan for substring match)
3. Check character count: `wc -c < context/MEMORY.md`
4. If under 2,500 chars: append the new fact under the appropriate section
5. If over cap: consolidate — merge similar entries, remove stale ones, then add
6. Actions: add (append), replace (find substring + swap), remove (confirm with user first)
7. After writing: "Saved — will be active from next session."
```

### Memory Retrieval

```markdown
### Memory Retrieval

When the user asks about past context, conversations, or decisions:

1. **Tier 0**: Check `context/MEMORY.md` and today's daily log — already in context, zero cost
2. **L1**: Run `memsearch search "query" --top-k 5` — hybrid vector + keyword search. Finds semantic matches even with different words (e.g. "pricing" finds "monetisation")
3. **L2**: Run `memsearch expand <chunk_hash>` — returns full markdown section around the match
4. **L3**: Run `memsearch transcript <session_id>` — raw dialogue, last resort
5. **Fallback**: "I don't have a record of that."

Only escalate if the previous tier didn't find the answer.
```

### Daily Log

```markdown
### Daily Log

Track session activity in `context/memory/{YYYY-MM-DD}.md`. One file per day, numbered session blocks:

#### Session N
**Goal**: [one line, filled when user states their goal]
**Deliverables**: [files created/modified]
**Decisions**: [key decisions and rationale]
**Open threads**: [anything unfinished]

Log these silently as they happen. Never announce "I've logged that."
```

---

## Step 6 — memory-write skill (optional, if .claude/skills/ exists)

Create `.claude/skills/memory-write/SKILL.md`:

```markdown
---
name: memory-write
description: >
  Saves durable facts to context/MEMORY.md. Triggers on "remember this",
  "note that", "update memory", "save this", "forget about". Three actions:
  add (append under correct section), replace (substring match + swap),
  remove (confirm with user first). Enforces 2,500 char cap with dedup guard.
---

# Memory Write

## Outcome
- Fact added to, updated in, or removed from `context/MEMORY.md`
- Character cap enforced (2,500 chars)
- Confirmation message: "Saved — will be active from next session."

## Steps

1. Read `context/MEMORY.md` in full
2. Determine action: add, replace, or remove
3. **Dedup check**: scan for substring match — if the fact already exists, skip or update
4. **Cap check**: run `wc -c < context/MEMORY.md` — if over 2,500, consolidate before adding
5. Write the change
6. Confirm: "Saved — will be active from next session."

For **remove**: always confirm with the user before deleting.

## Sections in MEMORY.md
- `## Active Threads` — current work, open questions
- `## Environment Notes` — URLs, API keys (names only), tool versions, project structure
- `## Pending Decisions` — decisions that need to be made

## Rules
- Never exceed 2,500 characters
- Always check for duplicates before adding
- Replace is preferred over add when updating existing facts
```

---

## Step 7 — Configure MemSearch embedding provider

Create `.memsearch.toml` in the repo root:

```toml
[embedding]
provider = "onnx"
```

This overrides the default (OpenAI) with local ONNX inference — no API key needed.
Commit this file so everyone on the team gets the same setting.

---

## Step 8 — Update .gitignore

Add these two lines (skip any already present):

```
context/transcripts/
.memsearch/
```

`context/transcripts/` — machine-local transcript captures, not shared  
`.memsearch/` — local vector database, rebuilt per-machine by `memsearch index`

---

## Step 9 — Indexing scripts

Copy `scripts/memsearch-index.sh` and `scripts/fetch-external-docs.py` from this repo (or scaffold them — see below).

**`scripts/memsearch-index.sh`** — rebuilds the local vector index from all sources:

```bash
scripts/memsearch-index.sh           # index memory + external docs
scripts/memsearch-index.sh --fetch   # fetch external docs first, then index
scripts/memsearch-index.sh --force   # re-embed everything (ignore cache)
```

**`scripts/fetch-external-docs.py`** — pulls external docs into `context/external/` as markdown. All sources are opt-in via env vars — set only what you have:

| Source | Required env vars |
|--------|-------------------|
| Notion | `NOTION_API_KEY`, `NOTION_DATABASE_IDS` (comma-separated) |
| Confluence | `CONFLUENCE_URL`, `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN`, `CONFLUENCE_SPACE_KEYS` |
| Local folder | `LOCAL_DOCS_PATH` (absolute path to any local docs directory) |

Unset sources are silently skipped. The script prints which were active and which were skipped on each run.

**First run (local machine only):**

```bash
pip install 'memsearch[onnx]'
scripts/memsearch-index.sh
```

First run downloads the bge-m3 model (~558 MB, cached permanently at `~/.cache/huggingface/hub/`). Subsequent runs are fully offline and complete in seconds.

Remote/CI environments: skip indexing — they lack writable caches and persistent storage. The markdown source files in `context/` are what CI needs; the vector index is a local dev tool.

---

## Verification

After setup, start a new Claude Code session and confirm:

1. Claude reads `context/MEMORY.md` and `context/USER.md` silently at startup (no output)
2. Say **"remember that our staging URL is staging.example.com"** → Claude writes to `context/MEMORY.md`
3. After any response, check `context/transcripts/{today}.md` has a new entry
4. Run `scripts/memsearch-index.sh` then `memsearch search "staging"` → finds the entry
5. In a new session, ask **"what's our staging URL?"** → Tier 0 finds it in `context/MEMORY.md` without a search

---

## Files summary

| File | Action | Purpose |
|------|--------|---------|
| `context/MEMORY.md` | Create (if missing) | Curated working memory, 2,500-char cap |
| `context/USER.md` | Create (if missing) | User profile and preferences, 1,375-char cap |
| `context/memory/` | Create directory | Daily session logs (git-tracked, shared) |
| `context/external/` | Create directory | External doc exports (git-tracked, shared) |
| `context/transcripts/` | Create directory | Transcript captures (gitignored, machine-local) |
| `scripts/memory-stats.sh` | Create | Health dashboard — utilization, cadence, token cost |
| `scripts/memsearch-index.sh` | Create | Rebuilds vector index from all sources |
| `scripts/fetch-external-docs.py` | Create | Pulls Notion/Confluence/local docs → markdown |
| `.claude/hooks/transcript-capture.js` | Create | Stop hook — auto-captures each response |
| `.claude/skills/memory-write/SKILL.md` | Create (if skills dir exists) | Curated write/dedup/cap skill |
| `.memsearch.toml` | Create | Sets ONNX provider (no API key) |
| `CLAUDE.md` | Add sections | Session startup, budget, write, retrieval, daily log |
| `.claude/settings.json` | Add Stop hook entry | Wires transcript-capture.js |
| `.gitignore` | Add two lines | Excludes transcripts/ and .memsearch/ |

---

## Embedding provider options

| Provider | Cost | Requires | Notes |
|----------|------|----------|-------|
| `onnx` (recommended) | Free | `pip install 'memsearch[onnx]'`, first-run HuggingFace download | CPU-only, fully offline after model cache, bge-m3-onnx-int8 |
| `ollama` | Free | Ollama running locally | `pip install 'memsearch[ollama]'`, use `nomic-embed-text` or similar |
| `openai` (default) | ~$0.02/1M tokens | `OPENAI_API_KEY` | Highest throughput for large corpora |
| `google` | Varies | GCP credentials | `pip install 'memsearch[google]'` |

Switch provider: `memsearch config set embedding.provider <name>` (or edit `.memsearch.toml`).

---

## Monitoring

Run `scripts/memory-stats.sh` at any time for a health dashboard:

```
=== Memory System Health ===

Working memory
  MEMORY.md     847 / 2500 chars  ######..............  34%
  USER.md       312 / 1375 chars  ####................  23%

Session logs
  Daily logs: 12 file(s)  (2026-05-28 → 2026-06-14)
  Last log:   2026-06-14 — 42 line(s)

Transcripts (machine-local, gitignored)
  Captures:  8 file(s), 24 KB total
  Latest:    2026-06-14

External docs (context/external/, git-tracked)
  notion: 14 file(s)

Vector index (machine-local, .memsearch/)
  Chunks indexed: 312
  Last indexed:   2026-06-14 09:30

Estimated inject cost per session
  MEMORY.md:   ~212 tokens
  USER.md:     ~78 tokens
  Today's log: ~105 tokens
  ─────────────────────────────
  Total inject: ~395 tokens  (chars ÷ 4, rough estimate)

  Budget: 3,000 tokens target. Claude's context window: 200k tokens.
  Memory overhead: ~0% of available context.
```

**What to watch:**
- `MEMORY.md` bar hitting yellow (70%) or red (90%) → time to consolidate entries
- Session logs cadence → confirms Claude is writing daily logs each session
- Total inject staying well under 3,000 tokens → healthy; if it creeps up, trim USER.md or MEMORY.md

**Exact token counts** aren't exposed by Claude Code, so the estimate uses `chars ÷ 4` (conservative; real tokenization is closer to `chars ÷ 3.5` for mixed code/prose). Directionally accurate — good enough for budget monitoring.

---

## Team sharing

The vector index itself (`.memsearch/`, gitignored) is a derived artifact — each developer builds it locally. What gets shared via git is the **source**:

| Shared via git (source) | Machine-local (derived) |
|-------------------------|------------------------|
| `context/memory/*.md` — daily logs | `.memsearch/` — vector DB |
| `context/external/**/*.md` — doc exports | `context/transcripts/` — transcripts |
| `context/MEMORY.md`, `context/USER.md` | `~/.cache/memsearch/` — ONNX model |

**After `git pull`**, any developer rebuilds their index in one command:

```bash
scripts/memsearch-index.sh
```

This avoids committing binary database blobs (which generate unreadable diffs and balloon git history). The tradeoff: a ~seconds rebuild step after pulling instead of instant search. For most teams this is the right call.

> **Why not commit the `.db` file?** Milvus-lite stores data as a binary SQLite blob. Every re-index produces a completely different binary diff — git can't compress or diff it. A 500-doc index is ~10–30 MB of opaque binary per commit. Git LFS solves this but adds infrastructure. The markdown-as-source-of-truth approach avoids the problem entirely.

## External docs ingestion

`scripts/fetch-external-docs.py` writes markdown files into `context/external/`, which are then committed and shared. Teammates get new docs on `git pull` without running the fetch script themselves.

**Recommended workflow for the person who owns doc syncing:**

```bash
# Pull latest docs from all configured sources
NOTION_API_KEY=... NOTION_DATABASE_IDS=page-id-1,page-id-2 \
  scripts/memsearch-index.sh --fetch

# Commit the updated markdown exports
git add context/external/
git commit -m "docs(memory): refresh external docs from Notion"
git push
```

**Or automate with a GitHub Action** (cron, nightly):

```yaml
- name: Fetch and commit external docs
  env:
    NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
    NOTION_DATABASE_IDS: ${{ vars.NOTION_DATABASE_IDS }}
  run: |
    pip install memsearch 'memsearch[onnx]' notion-client
    python3 scripts/fetch-external-docs.py
    git add context/external/
    git diff --cached --quiet || git commit -m "chore: refresh external docs"
    git push
```

Note: the GitHub Action only fetches and commits the markdown. It does **not** run `memsearch index` — that stays local per developer.

## Maintenance

- **After `git pull`**: run `scripts/memsearch-index.sh` to incorporate new daily logs and external docs
- **Weekly**: review `context/MEMORY.md` — prune stale entries, merge duplicates, stay under 2,500 chars
- **When adding a new external source**: set the relevant env vars, run `scripts/memsearch-index.sh --fetch`, commit `context/external/`
- **Context/transcripts is gitignored** — each developer's local transcript history stays on their machine
