"""Loads settings.yaml and resolves credentials.

WHAT THIS TOOL TALKS TO, AND WHY IT IS THREE THINGS
Google Play does not have one API. It has three surfaces with three different
auth stories, and the metric you want decides which one you are on:

  Cloud Storage bucket     Installs, uninstalls, acquisition by traffic source,
  (pubsite_prod_rev_*)     store-listing conversion, retained installers,
                           ratings, crashes. THIS IS WHERE THE NUMBERS LIVE.
                           Monthly CSVs, UTF-16, ~2-3 day lag.

  Play Developer           App vitals ONLY — crash rate, ANR rate, slow start,
  Reporting API            memory, plus error clustering and anomalies.
                           It has NO install or acquisition data. Do not go
                           looking; that is what the bucket is for.

  Android Publisher API    Track releases: which versionCode is live on which
                           track, its rollout fraction and release notes. This
                           is the only way to get real Play rollout dates, as
                           opposed to the merge dates in git, which lead them.

THE BUCKET IS NOT IN YOUR CLOUD PROJECT
`gsutil ls` against therr-app will never show it. The reports bucket lives in a
Google-owned project attached to the Play developer account, and you address it
by its full URI. Access is granted through Play Console -> Users and permissions,
NOT through IAM on your own project. Both facts make the usual "check the
project" debugging instinct waste twenty minutes. Get the URI from
Play Console -> Download reports -> any report -> Copy Cloud Storage URI.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SETTINGS_PATH = PACKAGE_ROOT / "settings.yaml"

# The bucket half needs read access to Cloud Storage; the other two each have
# their own scope. ADC minted by `gcloud auth application-default login` carries
# only cloud-platform, which covers storage but NOT the two Play scopes — that
# is why auth.py tells you to re-run login with --scopes when they 403.
SCOPES = [
    "https://www.googleapis.com/auth/devstorage.read_only",
    "https://www.googleapis.com/auth/playdeveloperreporting",
    "https://www.googleapis.com/auth/androidpublisher",
]


class SettingsError(RuntimeError):
    """Configuration is missing or unusable. Always carries the fix in the message."""


@dataclass
class AppSettings:
    """One Play listing.

    `package` is the Android applicationId, and it is the join key for every
    filename in the bucket. Getting it wrong produces an empty result rather
    than an error, because a missing monthly report and a wrong package name are
    indistinguishable from the client side.
    """

    key: str
    package: str
    label: str = ""

    def __post_init__(self) -> None:
        if not self.package:
            raise SettingsError(f"app '{self.key}' has no package name.")
        self.label = self.label or self.key


@dataclass
class Settings:
    bucket: str = ""
    apps: dict[str, AppSettings] = field(default_factory=dict)
    default_app: str = ""
    credentials_path: str = ""
    # Cloud project billed for API calls made with YOUR OWN credentials.
    #
    # User credentials (unlike a service account) carry no project of their own,
    # so googleapis bills them to gcloud's shared default client project and the
    # Play APIs refuse with SERVICE_DISABLED naming a project number you have
    # never seen (764086051850). Setting this makes the call bill to a project
    # you control and can enable APIs on. Not needed for a service account,
    # which brings its own project.
    quota_project: str = ""
    max_rows: int = 2000

    def app(self, key: str | None) -> AppSettings:
        """Resolve an app key to its settings, defaulting deliberately.

        There are two Therr apps in one developer account and their numbers are
        not comparable — the flagship is app.therrmobile, Friends With Habits is
        com.therr.habits. Silently defaulting to "the first one" is how a report
        ends up labelled with the wrong product, so an ambiguous request with no
        configured default is an error, not a guess.
        """
        key = key or self.default_app
        if not key:
            raise SettingsError(
                "No app specified and no default_app set in settings.yaml. "
                f"Configured apps: {', '.join(sorted(self.apps)) or '(none)'}"
            )
        if key in self.apps:
            return self.apps[key]
        # Accept a raw package name too, so a caller who knows the applicationId
        # is not forced to learn our nickname for it.
        for app in self.apps.values():
            if app.package == key:
                return app
        raise SettingsError(
            f"Unknown app '{key}'. Configured: {', '.join(sorted(self.apps)) or '(none)'}"
        )

    def require_bucket(self) -> str:
        """The bucket NAME, however the URI was pasted.

        Play Console's "Copy Cloud Storage URI" gives you a path INTO the bucket
        (gs://pubsite_prod_123/stats/installs/), not the bucket root, so the
        natural paste carries a prefix that would otherwise be treated as part
        of the name and 404 every object lookup. Take the first path segment.

        Both bucket shapes are live in the wild: older developer accounts get
        `pubsite_prod_rev_<digits>`, newer ones `pubsite_prod_<digits>`. Neither
        is validated here beyond the prefix, because guessing wrong about the
        format is worse than letting a real 404 say so.
        """
        if not self.bucket:
            raise SettingsError(
                "settings.yaml has no `bucket`. Find it in Play Console -> Download "
                "reports -> (any report) -> Copy Cloud Storage URI. It looks like "
                "gs://pubsite_prod_1234567890123456789. Only the reports bucket "
                "carries installs and acquisition data."
            )
        return self.bucket.replace("gs://", "").strip("/").split("/", 1)[0]


def load_settings(path: Path | None = None) -> Settings:
    path = path or DEFAULT_SETTINGS_PATH
    if not path.exists():
        raise SettingsError(
            f"{path} not found. Copy settings.example.yaml to settings.yaml and fill in "
            "`bucket` and at least one entry under `apps`."
        )
    raw = yaml.safe_load(path.read_text()) or {}
    if not isinstance(raw, dict):
        raise SettingsError(f"{path} did not parse to a mapping.")

    apps: dict[str, AppSettings] = {}
    for key, value in (raw.get("apps") or {}).items():
        if isinstance(value, str):
            apps[key] = AppSettings(key=key, package=value)
        elif isinstance(value, dict):
            apps[key] = AppSettings(
                key=key, package=value.get("package", ""), label=value.get("label", "")
            )
        else:
            raise SettingsError(f"apps.{key} must be a package string or a mapping.")

    # An env var wins over the file so the MCP server can be pointed at a
    # different service account without editing a gitignored file.
    creds = os.environ.get("GOOGLE_PLAY_CREDENTIALS") or raw.get("credentials_path", "")

    return Settings(
        quota_project=(
            os.environ.get("GOOGLE_CLOUD_PROJECT")
            or raw.get("quota_project", "")
        ),
        bucket=os.environ.get("GOOGLE_PLAY_BUCKET") or raw.get("bucket", ""),
        apps=apps,
        default_app=raw.get("default_app", ""),
        credentials_path=str(Path(creds).expanduser()) if creds else "",
        max_rows=int(raw.get("max_rows", 2000)),
    )
