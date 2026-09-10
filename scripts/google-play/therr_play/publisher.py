"""Android Publisher API: which versionCode is actually live, and since when.

WHY THIS MATTERS FOR ATTRIBUTION
Correlating a growth curve against git merge dates is wrong by an unknown lag.
A commit merges to niche/HABITS-main, CI builds, the build is uploaded, and then
a staged rollout releases it to some percentage of users over days. The merge
date can lead the date users actually got the code by a week. This module reads
the track state Play itself holds, which is the only honest x-axis for "did the
release move the metric".

THE EPHEMERAL EDIT
There is no read-only endpoint for tracks. The API models everything as a
transactional "edit": you insert one, read through it, and delete it. An edit
that is never committed changes nothing — but an edit left dangling holds a lock
that makes later edits fail with editAlreadyCommitted-style errors, so
`_with_edit` deletes in a finally block. Nothing here calls edits.commit(), and
nothing should; this tool is read-only by construction.

WHAT PLAY DOES NOT GIVE YOU
There is no "released on" timestamp in the tracks response. You get the current
state: versionCodes, status (completed / inProgress / halted), and userFraction.
For historical rollout dates, the release notes and the versionCode sequence are
the evidence, and Play Console's release dashboard is the source of truth.
"""

from __future__ import annotations

from contextlib import contextmanager

from therr_play.settings import SettingsError

TRACKS = ("production", "beta", "alpha", "internal")


def publisher_client(credentials):
    try:
        from googleapiclient.discovery import build
    except ImportError as exc:  # pragma: no cover - environment problem
        raise SettingsError(
            "google-api-python-client is not installed. From scripts/google-play:\n"
            "    python3 -m venv .venv && . .venv/bin/activate && "
            "pip install -r requirements.txt"
        ) from exc
    return build("androidpublisher", "v3", credentials=credentials, cache_discovery=False)


@contextmanager
def _with_edit(service, package: str):
    """Open an edit, hand it over, and always discard it."""
    edit = service.edits().insert(body={}, packageName=package).execute()
    edit_id = edit["id"]
    try:
        yield edit_id
    finally:
        try:
            service.edits().delete(packageName=package, editId=edit_id).execute()
        except Exception:
            # A failed cleanup must not mask the real error from the body of the
            # block. Dangling edits expire on their own after ~7 days.
            pass


def list_tracks(service, package: str, tracks: tuple[str, ...] = TRACKS) -> list[dict]:
    """Current release state per track, newest versionCode first."""
    out: list[dict] = []
    with _with_edit(service, package) as edit_id:
        for track in tracks:
            try:
                data = (
                    service.edits()
                    .tracks()
                    .get(packageName=package, editId=edit_id, track=track)
                    .execute()
                )
            except Exception as exc:
                # A track the app has never used 404s. That is information, not
                # an error worth aborting the whole call for.
                out.append({"track": track, "error": str(exc), "releases": []})
                continue
            releases = []
            for release in data.get("releases", []):
                releases.append(
                    {
                        "name": release.get("name"),
                        "status": release.get("status"),
                        "versionCodes": release.get("versionCodes", []),
                        "userFraction": release.get("userFraction"),
                        "releaseNotes": [
                            {"language": n.get("language"), "text": n.get("text")}
                            for n in release.get("releaseNotes", [])
                        ],
                    }
                )
            out.append({"track": track, "releases": releases})
    return out


def list_reviews(service, package: str, max_results: int = 50) -> list[dict]:
    """Reviews via the API rather than the bucket.

    The bucket's reviews CSV is monthly and complete; this endpoint is capped to
    roughly the last week but is live. Use the bucket for analysis, this for
    "what came in today".
    """
    response = (
        service.reviews().list(packageName=package, maxResults=max_results).execute()
    )
    reviews = []
    for review in response.get("reviews", []):
        comments = review.get("comments", [])
        user = comments[0].get("userComment", {}) if comments else {}
        reviews.append(
            {
                "reviewId": review.get("reviewId"),
                "authorName": review.get("authorName"),
                "starRating": user.get("starRating"),
                "text": user.get("text"),
                "appVersionName": user.get("appVersionName"),
                "device": user.get("device"),
                "lastModified": (user.get("lastModified") or {}).get("seconds"),
            }
        )
    return reviews
