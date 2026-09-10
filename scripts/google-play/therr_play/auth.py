"""Credential resolution, and the two ways this fails that look identical.

TWO SUPPORTED PATHS
  1. A service account JSON, invited into Play Console. Use this for anything
     scheduled or shared. `credentials_path` in settings.yaml, or the
     GOOGLE_PLAY_CREDENTIALS env var.
  2. Your own user credentials via Application Default Credentials. Fastest way
     to get answers today, because the Play developer account is already yours.

THE ADC SCOPE TRAP
`gcloud auth application-default login` mints a token scoped to cloud-platform
only. That is enough for the Cloud Storage bucket and nothing else, so the
bucket tools work, the vitals and releases tools 403, and it reads like a
permissions problem in Play Console rather than a scope problem on your laptop.
Re-mint with the scopes spelled out:

    gcloud auth application-default login \
      --scopes=https://www.googleapis.com/auth/cloud-platform,\
https://www.googleapis.com/auth/playdeveloperreporting,\
https://www.googleapis.com/auth/androidpublisher

THE SERVICE ACCOUNT TRAP
A service account needs THREE things done, in different consoles, and missing
any one of them produces a 403 with the same shape:
  a. The account exists and you have its JSON key (Cloud Console).
  b. "Google Play Android Developer API" and "Google Play Developer Reporting
     API" are ENABLED on the Cloud project that owns it (Cloud Console).
  c. The service account's email is invited under Play Console -> Users and
     permissions, with at least "View app information and download bulk
     reports". Invitations take a few minutes to propagate.
Step (c) is the one people skip, because nothing in Cloud Console hints that a
separate product has to bless the account.
"""

from __future__ import annotations

from therr_play.settings import SCOPES, Settings, SettingsError

_MISSING_LIB = (
    "google-auth is not installed. From scripts/google-play:\n"
    "    python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt"
)

_SCOPE_HINT = (
    "If this is a 403 on vitals or releases but the bucket tools work, it is the ADC "
    "scope trap, not Play permissions — see the header of therr_play/auth.py."
)


def get_credentials(settings: Settings):
    """Return google.auth credentials for whichever path is configured."""
    try:
        import google.auth
        from google.oauth2 import service_account
    except ImportError as exc:  # pragma: no cover - environment problem, not logic
        raise SettingsError(_MISSING_LIB) from exc

    if settings.credentials_path:
        from pathlib import Path

        path = Path(settings.credentials_path)
        if not path.exists():
            raise SettingsError(
                f"credentials_path {path} does not exist. Either fix the path in "
                "settings.yaml, or remove it to fall back to your own gcloud "
                "credentials (see auth.py header)."
            )
        return service_account.Credentials.from_service_account_file(
            str(path), scopes=SCOPES
        )

    try:
        credentials, _ = google.auth.default(scopes=SCOPES)
        # User credentials have no project of their own. Without this the Play
        # APIs bill to gcloud's shared default client project and refuse.
        if settings.quota_project and hasattr(credentials, "with_quota_project"):
            credentials = credentials.with_quota_project(settings.quota_project)
    except Exception as exc:
        raise SettingsError(
            "No credentials. Either set credentials_path in settings.yaml to a Play "
            "service account key, or run:\n"
            "    gcloud auth application-default login --scopes=" + ",".join(SCOPES) + "\n"
            f"Underlying error: {exc}"
        ) from exc
    return credentials


def describe_failure(exc: Exception) -> str:
    """Turn a Google API error into something that names the actual fix.

    The three 403s below look alike and have completely different fixes. Telling
    them apart is most of this module's value, because the generic advice
    ("check Play Console permissions") is wrong for two of the three.
    """
    text = str(exc)

    if "ACCESS_TOKEN_SCOPE_INSUFFICIENT" in text or "insufficient authentication scopes" in text:
        return f"{text}\n\n{_SCOPE_HINT}"

    if "SERVICE_DISABLED" in text or "requires a quota project" in text:
        return (
            f"{text}\n\nThis is the QUOTA PROJECT / API ENABLEMENT trap, not a Play "
            "Console permissions problem. Your own gcloud credentials carry no project, "
            "so the call bills to Google's shared default client project. Two fixes, "
            "both needed:\n"
            "  1. Set `quota_project: \"therr-app\"` in settings.yaml (or run "
            "`gcloud auth application-default set-quota-project therr-app`).\n"
            "  2. Enable the API on that project:\n"
            "     gcloud services enable playdeveloperreporting.googleapis.com "
            "androidpublisher.googleapis.com --project therr-app\n"
            "The bucket tools keep working throughout, because Cloud Storage does not "
            "require a quota project."
        )

    if "403" in text or "PERMISSION_DENIED" in text:
        return (
            f"{text}\n\nA plain 403 with the scopes and quota project already set is "
            "the Play Console step: the account must be invited under Play Console -> "
            "Users and permissions with at least 'View app information and download "
            "bulk reports'."
        )
    if "404" in text and "bucket" in text.lower():
        return (
            f"{text}\n\nA 404 on the bucket usually means the URI is wrong, not that "
            "access is missing — the reports bucket is not in your own Cloud project. "
            "Re-copy it from Play Console -> Download reports."
        )
    return text
