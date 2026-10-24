#!/usr/bin/env python3
"""Find recent Reddit posts where someone is asking for an accountability partner.

This is the listening half of a reply queue: it finds the threads and ranks them. Drafting the
replies is done by Claude in the daily scheduled session (see README.md), and **posting is always
done by a person**. Nothing here can write to Reddit — it only reads public listings — and that
is deliberate: automated replies get accounts banned and the domain filtered site-wide.

Standard library only, so it runs in any fresh cloud session without an install step.

    python3 scripts/reddit-listening/find_threads.py              # ranked candidates as JSON
    python3 scripts/reddit-listening/find_threads.py --markdown   # the same, readable

Reddit often refuses anonymous requests from cloud IP ranges. If REDDIT_CLIENT_ID and
REDDIT_CLIENT_SECRET are set (a "script" app from https://www.reddit.com/prefs/apps), the script
authenticates application-only and reads through oauth.reddit.com instead.

Exit codes: 0 ran (zero candidates is still success), 2 every subreddit failed to load — almost
always network policy or Reddit blocking the client, which the caller should report as such.
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from typing import Callable, Dict, List, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = os.path.join(HERE, "config.json")

# Reddit asks for a descriptive, unique User-Agent and throttles generic ones hardest.
USER_AGENT = "therr-habits-listening/1.0 (read-only reply queue; contact via reddit.com/u/therrapp)"
PUBLIC_BASE = "https://www.reddit.com"
OAUTH_BASE = "https://oauth.reddit.com"
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
# Anonymous access allows roughly 10 requests a minute; one subreddit at a time stays well under.
REQUEST_SPACING_SECONDS = 1.5
SNIPPET_LENGTH = 600

Fetcher = Callable[[str, Dict[str, str]], dict]


@dataclass
class Candidate:
    id: str
    subreddit: str
    title: str
    url: str
    author: str
    created_utc: float
    age_hours: float
    num_comments: int
    score: int
    snippet: str
    match_reasons: List[str] = field(default_factory=list)


def load_config(path: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        config = json.load(handle)
    config["_include"] = [(re.compile(rule["pattern"], re.I), rule["weight"], rule["pattern"]) for rule in config["include"]]
    config["_exclude"] = [(re.compile(rule["pattern"], re.I), rule["reason"]) for rule in config["exclude"]]
    return config


def http_get_json(url: str, headers: Dict[str, str]) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **headers})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def get_oauth_token(client_id: str, client_secret: str) -> str:
    """Application-only OAuth (client credentials). Read-only by construction: no user context."""
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    request = urllib.request.Request(TOKEN_URL, data=data, headers={
        "User-Agent": USER_AGENT,
        "Authorization": f"Basic {credentials}",
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))["access_token"]


def evaluate_post(post: dict, config: dict, now: float) -> Optional[Candidate]:
    """A listing entry's `data` → a ranked candidate, or None when it is not worth a reply.

    Pure, so the rules are unit-tested without the network.
    """
    if post.get("stickied") or post.get("locked") or post.get("archived") or post.get("over_18"):
        return None
    if post.get("removed_by_category") or post.get("author") in (None, "[deleted]", "AutoModerator"):
        return None

    age_hours = (now - float(post.get("created_utc", 0))) / 3600
    if age_hours < 0 or age_hours > config["max_age_hours"]:
        return None
    # A busy thread already has its answers; a reply there is noise.
    if int(post.get("num_comments", 0)) > config["max_comments"]:
        return None

    text = f"{post.get('title', '')}\n{post.get('selftext', '')}"
    for pattern, _reason in config["_exclude"]:
        if pattern.search(text):
            return None

    score = 0
    reasons = []
    for pattern, weight, _source in config["_include"]:
        match = pattern.search(text)
        if match:
            score += weight
            reasons.append(match.group(0).strip())
    if score < config["min_score"]:
        return None

    # Fresher and quieter threads are where a reply is still read.
    if age_hours <= 6:
        score += 2
    if int(post.get("num_comments", 0)) <= 3:
        score += 2

    selftext = re.sub(r"\s+", " ", post.get("selftext") or "").strip()
    return Candidate(
        id=post["id"],
        subreddit=post.get("subreddit", ""),
        title=post.get("title", "").strip(),
        url=f"https://www.reddit.com{post.get('permalink', '')}",
        author=post.get("author", ""),
        created_utc=float(post.get("created_utc", 0)),
        age_hours=round(age_hours, 1),
        num_comments=int(post.get("num_comments", 0)),
        score=score,
        snippet=selftext[:SNIPPET_LENGTH] + ("…" if len(selftext) > SNIPPET_LENGTH else ""),
        match_reasons=reasons,
    )


def rank_candidates(posts: List[dict], config: dict, now: float) -> List[Candidate]:
    seen = set()
    candidates = []
    for post in posts:
        if post.get("id") in seen:
            continue
        seen.add(post.get("id"))
        candidate = evaluate_post(post, config, now)
        if candidate:
            candidates.append(candidate)
    candidates.sort(key=lambda c: (-c.score, c.age_hours))
    return candidates[: config["max_results"]]


def summarize_rules(rules_payload: dict) -> List[str]:
    """Short form of a subreddit's rules, so drafts can respect self-promotion limits."""
    rules = rules_payload.get("rules") or []
    lines = []
    for rule in rules:
        name = (rule.get("short_name") or "").strip()
        description = re.sub(r"\s+", " ", rule.get("description") or "").strip()
        if name:
            lines.append(f"{name}: {description[:200]}" if description else name)
    return lines


def collect(config: dict, fetch: Fetcher, base: str, headers: Dict[str, str], sleep=time.sleep):
    """Read each subreddit's newest posts and its rules. Returns (posts, rules_by_sub, failures)."""
    posts: List[dict] = []
    rules: Dict[str, List[str]] = {}
    failures: Dict[str, str] = {}
    for index, subreddit in enumerate(config["subreddits"]):
        if index:
            sleep(REQUEST_SPACING_SECONDS)
        try:
            listing = fetch(f"{base}/r/{subreddit}/new.json?limit=100&raw_json=1", headers)
            posts.extend(child["data"] for child in listing.get("data", {}).get("children", []))
        except (urllib.error.URLError, OSError, ValueError, KeyError) as err:
            failures[subreddit] = str(err)
            continue
        try:
            rules[subreddit] = summarize_rules(fetch(f"{base}/r/{subreddit}/about/rules.json?raw_json=1", headers))
        except (urllib.error.URLError, OSError, ValueError, KeyError):
            rules[subreddit] = []
    return posts, rules, failures


def render_markdown(candidates: List[Candidate], rules: Dict[str, List[str]], failures: Dict[str, str]) -> str:
    lines = [f"# Accountability threads — {len(candidates)} candidate(s)", ""]
    for number, candidate in enumerate(candidates, 1):
        lines += [
            f"## {number}. r/{candidate.subreddit}: {candidate.title}",
            f"{candidate.url}",
            f"{candidate.age_hours}h old · {candidate.num_comments} comments · score {candidate.score} · matched: "
            + ", ".join(f'"{reason}"' for reason in candidate.match_reasons),
            "",
            f"> {candidate.snippet}" if candidate.snippet else "> (no body)",
            "",
        ]
    if failures:
        lines += ["## Could not read", *[f"- r/{sub}: {err}" for sub, err in failures.items()], ""]
    used = sorted({c.subreddit for c in candidates})
    if used:
        lines += ["## Rules of the subreddits above"]
        for sub in used:
            lines.append(f"- r/{sub}: " + (" | ".join(rules.get(sub) or ["(rules unavailable)"])))
    return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--markdown", action="store_true", help="print a readable digest instead of JSON")
    args = parser.parse_args(argv)

    config = load_config(args.config)
    base, headers = PUBLIC_BASE, {}
    client_id, client_secret = os.environ.get("REDDIT_CLIENT_ID"), os.environ.get("REDDIT_CLIENT_SECRET")
    if client_id and client_secret:
        try:
            headers = {"Authorization": f"Bearer {get_oauth_token(client_id, client_secret)}"}
            base = OAUTH_BASE
        except (urllib.error.URLError, OSError, ValueError, KeyError) as err:
            print(f"OAuth failed ({err}); falling back to anonymous access", file=sys.stderr)

    posts, rules, failures = collect(config, http_get_json, base, headers)
    if len(failures) == len(config["subreddits"]):
        print(json.dumps({"error": "every subreddit failed to load", "base": base, "failures": failures}, indent=2))
        return 2

    candidates = rank_candidates(posts, config, time.time())
    if args.markdown:
        print(render_markdown(candidates, rules, failures))
    else:
        print(json.dumps({
            "base": base,
            "candidates": [asdict(c) for c in candidates],
            "rules": {c.subreddit: rules.get(c.subreddit, []) for c in candidates},
            "failures": failures,
        }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
