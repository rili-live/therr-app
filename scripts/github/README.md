# GitHub MCP (`github-mcp-server`)

Exposes `rili-live/therr-app`'s issues to Claude Code as MCP tools, so
`/github-issues` and `/work-plan` can read, file, comment on and close issues
without shelling out.

This is the wrapper and its configuration. What the issues are *for* — the
`(#number)` cross-link with `docs/WORK_IN_PROGRESS.md`, deferring work
mid-session, closing the loop after a batch — lives in
[`.claude/skills/github-issues/SKILL.md`](../../.claude/skills/github-issues/SKILL.md)
and in that backlog's § The two halves of this backlog.

## Setup

```bash
brew install github-mcp-server     # the server itself
gh auth login                      # the credential it borrows, if not already done
```

Then **restart Claude Code**. MCP servers connect once, at startup — a running
session will not pick up a newly-registered server, however correct its config.

The first launch after this lands prompts you to approve `.mcp.json`. Until you
do, the server is registered but not connected:

```bash
claude mcp get github
#   Scope:  Project config (shared via .mcp.json)
#   Status: ⏸ Pending approval (run `claude` to approve)   ← before approval
#   Status: ✓ Connected                                     ← after
```

`⏸ Pending approval` is the expected first state, not a failure. A session in
that state falls back to the `gh` CLI and everything still works.

That is the whole setup. The wrapper is already registered in `.mcp.json`, which
is committed, so a teammate needs only the two commands above.

## No token is stored anywhere

`scripts/github/mcp-server` fetches a token from `gh auth token` at launch.
Nothing secret is written to `.mcp.json`, to a dotfile, or to the environment —
which matters because `.mcp.json` is committed, and a token pasted into it would
be published to everyone with repo access and live in git history afterwards.

The `gh` credential is stored in the OS keyring and already carries the `repo`
scope the issue tools need.

Set `GITHUB_PERSONAL_ACCESS_TOKEN` to override — for CI, or to use a
narrowly-scoped PAT instead of your `gh` login. It takes precedence and `gh` is
never consulted.

## Only two toolsets are loaded

The wrapper pins `--toolsets=issues,labels`, which is 11 tools:

```
add_issue_comment  get_label    issue_read       issue_write   label_write
list_issue_fields  list_issues  list_issue_types list_label    search_issues
sub_issue_write
```

Every tool `/github-issues` and `/work-plan` reference is in that set. The
server's `default` toolset is **44** tools — it adds pull requests, repos, users,
copilot and context, none of which those skills call.

This is not a micro-optimization: every loaded tool's schema sits in the context
window of every session in this repo, whether or not anything calls it. Widen it
only alongside a skill that needs the extra surface, by editing `TOOLSETS` in the
wrapper (or `THERR_GITHUB_MCP_TOOLSETS` for a one-off).

## When it does not connect

The wrapper fails with an instruction rather than a broken pipe, but Claude Code
surfaces only "failed to connect" — read the actual reason with:

```bash
./scripts/github/mcp-server </dev/null   # prints the diagnostic and exits 1
```

| Message | Fix |
|---|---|
| `github-mcp-server is not installed` | `brew install github-mcp-server` |
| `gh is installed but not authenticated` | `gh auth login`, then restart Claude Code |
| `No GITHUB_PERSONAL_ACCESS_TOKEN set and the gh CLI is not installed` | Install `gh`, or export a PAT with `repo` scope |

Nothing here prints to stdout — that is the JSON-RPC channel, and a single stray
line on it desynchronizes the protocol. Diagnostics go to stderr.

## The `gh` CLI still works

Both transports are supported, and the skills document both. MCP is the default
in a local session now that this server is registered; `gh` remains the path in
the Claude Code **web** app, where no binary is installed. Neither is preferred
on quality grounds — use whichever the session actually has.

One difference worth knowing, because it fails a write: `gh issue close --reason`
spells it `'not planned'`, with a space, where MCP's `state_reason` is
`not_planned`.
