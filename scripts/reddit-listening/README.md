# Reddit listening queue (Friends with Habits)

People post "looking for an accountability partner" on Reddit every day — the exact problem
Friends with Habits solves. This finds those threads once a day and drafts a helpful reply for
each, so posting takes a few minutes of human judgment instead of an hour of searching.

**It never posts.** Automated Reddit replies get accounts banned and domains filtered. A person
reads each draft, edits it, and posts it from their own account — or skips it.

## Pieces

| File | What it does |
|---|---|
| `find_threads.py` | Reads each subreddit's newest posts (public, read-only), filters and ranks them. Standard library only. |
| `config.json` | Subreddits, the patterns that make a post a candidate, and the ones that rule it out. |
| `REPLY_GUIDE.md` | The rules the drafting session follows: help first, respect each subreddit's self-promotion rules, disclose. |
| `tests/` | Unit tests for the filtering rules (`npm run test:reddit-listening`). |

## How it runs

A daily scheduled task in Claude Code (cloud) starts a fresh session that runs the script, drafts
replies per `REPLY_GUIDE.md`, and ends with the digest. The session's completion sends a push to
the Claude mobile app; tapping it opens the digest.

Run it by hand:

```bash
python3 scripts/reddit-listening/find_threads.py --markdown
```

## Network and credentials

The cloud environment must be allowed to reach `www.reddit.com` (and `oauth.reddit.com` when
using credentials) — set under the environment's Network access settings.

Reddit often refuses anonymous requests from cloud IP ranges. If the digest reports 403s, create a
"script" app at https://www.reddit.com/prefs/apps and add `REDDIT_CLIENT_ID` and
`REDDIT_CLIENT_SECRET` to the environment's variables. The script then reads through
`oauth.reddit.com` with application-only (read-only) access.

## Tuning

Edit `config.json`. A subreddit that keeps producing drafts you skip is the first thing to remove;
`min_score` raises the bar for a candidate, and `max_comments` drops threads that already have
their answers.
