#!/usr/bin/env python3
"""
fetch-external-docs.py — pull external documentation into context/external/
for memsearch indexing.

Sources are opt-in: set the relevant env vars to activate each one.
Output is plain markdown committed to git, so the team shares it via git pull.

Supported sources:
  Notion    — set NOTION_API_KEY + NOTION_DATABASE_IDS (comma-separated page/db IDs)
  Confluence — set CONFLUENCE_URL + CONFLUENCE_EMAIL + CONFLUENCE_API_TOKEN +
               CONFLUENCE_SPACE_KEYS (comma-separated space keys, e.g. "ENG,PROD")

Run manually:
  python3 scripts/fetch-external-docs.py

Or via the index script:
  scripts/memsearch-index.sh --fetch

Add to a nightly cron / GitHub Action for automatic refresh:
  0 2 * * * cd /path/to/repo && python3 scripts/fetch-external-docs.py && scripts/memsearch-index.sh
"""

import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
EXTERNAL_DIR = REPO_ROOT / "context" / "external"
EXTERNAL_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]


def write_page(dest_dir: Path, filename: str, title: str, body: str) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    path = dest_dir / filename
    path.write_text(f"# {title}\n\n{body}\n", encoding="utf-8")
    print(f"  ✓ {path.relative_to(REPO_ROOT)}")


# ---------------------------------------------------------------------------
# Notion
# ---------------------------------------------------------------------------

def fetch_notion() -> bool:
    api_key = os.environ.get("NOTION_API_KEY", "")
    db_ids_raw = os.environ.get("NOTION_DATABASE_IDS", "")

    if not api_key:
        print("  Notion: skipped (NOTION_API_KEY not set)")
        return False
    if not db_ids_raw:
        print("  Notion: skipped (NOTION_DATABASE_IDS not set)")
        return False

    # TODO: install notion-client → pip install notion-client
    try:
        from notion_client import Client  # type: ignore
    except ImportError:
        print("  Notion: skipped (pip install notion-client)")
        return False

    notion = Client(auth=api_key)
    dest = EXTERNAL_DIR / "notion"
    db_ids = [d.strip() for d in db_ids_raw.split(",") if d.strip()]

    print(f"  Notion: fetching {len(db_ids)} database(s)...")
    fetched = 0

    for db_id in db_ids:
        try:
            results = notion.databases.query(database_id=db_id).get("results", [])
            for page in results:
                title_prop = next(
                    (v for v in page.get("properties", {}).values()
                     if v.get("type") == "title"),
                    None,
                )
                title = (
                    title_prop["title"][0]["plain_text"]
                    if title_prop and title_prop.get("title")
                    else page["id"]
                )
                # Fetch page blocks and convert to plain text
                blocks = notion.blocks.children.list(block_id=page["id"]).get("results", [])
                lines = []
                for b in blocks:
                    btype = b.get("type", "")
                    rich = b.get(btype, {}).get("rich_text", [])
                    text = "".join(r.get("plain_text", "") for r in rich)
                    if text:
                        lines.append(text)
                body = "\n\n".join(lines) if lines else "_No content_"
                write_page(dest, f"{slug(title)}.md", title, body)
                fetched += 1
        except Exception as exc:
            print(f"  Notion: error on db {db_id}: {exc}")

    print(f"  Notion: wrote {fetched} page(s) → context/external/notion/")
    return fetched > 0


# ---------------------------------------------------------------------------
# Confluence
# ---------------------------------------------------------------------------

def fetch_confluence() -> bool:
    base_url = os.environ.get("CONFLUENCE_URL", "")          # e.g. https://myorg.atlassian.net
    email = os.environ.get("CONFLUENCE_EMAIL", "")
    token = os.environ.get("CONFLUENCE_API_TOKEN", "")
    space_keys_raw = os.environ.get("CONFLUENCE_SPACE_KEYS", "")

    if not all([base_url, email, token]):
        print("  Confluence: skipped (CONFLUENCE_URL / CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN not set)")
        return False
    if not space_keys_raw:
        print("  Confluence: skipped (CONFLUENCE_SPACE_KEYS not set)")
        return False

    # TODO: install requests → pip install requests (usually already present)
    try:
        import requests  # type: ignore
    except ImportError:
        print("  Confluence: skipped (pip install requests)")
        return False

    from requests.auth import HTTPBasicAuth

    auth = HTTPBasicAuth(email, token)
    headers = {"Accept": "application/json"}
    dest = EXTERNAL_DIR / "confluence"
    space_keys = [s.strip() for s in space_keys_raw.split(",") if s.strip()]

    print(f"  Confluence: fetching {len(space_keys)} space(s)...")
    fetched = 0

    for space_key in space_keys:
        start = 0
        limit = 50
        while True:
            url = (
                f"{base_url.rstrip('/')}/wiki/rest/api/content"
                f"?spaceKey={space_key}&type=page&expand=body.storage"
                f"&start={start}&limit={limit}"
            )
            try:
                resp = requests.get(url, headers=headers, auth=auth, timeout=30)
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                print(f"  Confluence: error fetching space {space_key}: {exc}")
                break

            pages = data.get("results", [])
            for page in pages:
                title = page.get("title", page["id"])
                # Strip HTML tags from Confluence storage format
                html = page.get("body", {}).get("storage", {}).get("value", "")
                text = re.sub(r"<[^>]+>", " ", html)
                text = re.sub(r"\s{2,}", "\n\n", text).strip()
                body = text if text else "_No content_"
                write_page(dest / space_key.lower(), f"{slug(title)}.md", title, body)
                fetched += 1

            if data.get("size", 0) < limit:
                break
            start += limit

    print(f"  Confluence: wrote {fetched} page(s) → context/external/confluence/")
    return fetched > 0


# ---------------------------------------------------------------------------
# Local markdown folder (no credentials needed)
# ---------------------------------------------------------------------------

def fetch_local_folder() -> bool:
    """
    Copy markdown files from a local docs folder into context/external/local/.
    Set LOCAL_DOCS_PATH to the absolute path of any local documentation folder.
    Example: LOCAL_DOCS_PATH=/Users/you/company-wiki
    """
    local_path_raw = os.environ.get("LOCAL_DOCS_PATH", "")
    if not local_path_raw:
        print("  Local folder: skipped (LOCAL_DOCS_PATH not set)")
        return False

    local_path = Path(local_path_raw).expanduser()
    if not local_path.is_dir():
        print(f"  Local folder: skipped ({local_path} does not exist)")
        return False

    dest = EXTERNAL_DIR / "local"
    md_files = list(local_path.rglob("*.md"))
    print(f"  Local folder: copying {len(md_files)} files from {local_path}...")

    for src_file in md_files:
        rel = src_file.relative_to(local_path)
        dest_file = dest / rel
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        dest_file.write_bytes(src_file.read_bytes())
        print(f"  ✓ context/external/local/{rel}")

    print(f"  Local folder: copied {len(md_files)} file(s) → context/external/local/")
    return bool(md_files)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=== fetch-external-docs ===")
    print(f"Output: {EXTERNAL_DIR.relative_to(REPO_ROOT)}/")
    print()

    results = {
        "notion": fetch_notion(),
        "confluence": fetch_confluence(),
        "local": fetch_local_folder(),
    }

    active = [k for k, v in results.items() if v]
    skipped = [k for k, v in results.items() if not v]

    print()
    if active:
        print(f"✓ Fetched: {', '.join(active)}")
    if skipped:
        print(f"  Skipped: {', '.join(skipped)} (env vars not set)")
    print()
    print("Next: run scripts/memsearch-index.sh to rebuild the search index")


if __name__ == "__main__":
    main()
