# Backlog

Deferred features, roughly in priority order. Each entry notes the rationale and
a rough approach so it can be picked up later.

## Sub-agents
Spawn isolated agent runs for parallel exploration/research (like a lightweight
Explore/Plan agent). **Approach:** a `spawn_agent` tool whose `execute` constructs
a child `AgentLoop` with its own message history and a read-only tool subset,
returning the child's final text. Keep depth at 1 to start.

## Web search / fetch
Let the agent look up docs during a task. **Approach:** add `web_search` and
`web_fetch` tools. For Anthropic, optionally delegate to the server-side
`web_search_20260209` tool instead of a client tool; for Gemini use grounding.
Start with a simple client-side `web_fetch` (HTTP GET + readability extraction).

## MCP client support
Connect external tool servers (e.g. the GitHub MCP). **Approach:** an MCP client
that lists a server's tools and adapts them into the `Tool` interface
(`jsonSchema` is already the right shape), registered alongside built-in tools.
Largest surface area — do after the above.

## Rich TUI (Ink)
Live-updating panes, spinners, key handling. **Approach:** an alternative
renderer implementing `AgentUI` backed by Ink, selected by a flag/config. The
loop is already UI-agnostic, so this is additive. Heavier and harder to unit
test than the current minimal renderer.

## One-shot / `--print` mode
Run a single prompt non-interactively for scripting/CI. **Approach:** a code path
that builds the same `AgentLoop` but feeds one prompt, streams to stdout, and
exits; permission gate falls back to allowlist-only (no prompts).

## Conversation persistence / resume
Save/restore `AgentLoop.getMessages()` to disk; `--resume` to continue a session.
Pair with token-budget-aware compaction once histories get long (Anthropic
compaction beta; manual summarization for Gemini).

## ripgrep-backed grep
The `grep` tool currently walks the tree in JS. **Approach:** detect `rg` on
PATH and shell out for speed + .gitignore awareness, falling back to the JS
implementation when absent.
