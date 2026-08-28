"""OAuth: mint the refresh token config.yaml needs.

    ./therrads auth login          # browser flow, writes refresh_token into config.yaml
    ./therrads auth login --no-browser   # headless/SSH: paste the code back
    ./therrads auth check          # prove the whole credential set works

THE FOUR CREDENTIALS ARE NOT THE SAME THING
People conflate these constantly, and every one of them fails differently:

  developer token   From the Google Ads API Center, on your MANAGER account.
                    Identifies the *application* to Google Ads. Not OAuth. Not
                    minted here. A new one is "Test Account" level and will
                    reject every call against a real account with
                    DEVELOPER_TOKEN_NOT_APPROVED until you apply for Basic.
  OAuth client      From Google Cloud Console. Must be type "Desktop app".
                    Identifies the *program* requesting access.
  refresh token     Minted HERE. Identifies the *person* granting access, and
                    is what this module exists to produce.
  login_customer_id The manager account you authenticate through. Not a
                    credential, but a wrong value produces
                    USER_PERMISSION_DENIED, which reads like a credential error.

WHY THE REFRESH TOKEN KEEPS EXPIRING AFTER A WEEK
While the Cloud project's OAuth consent screen is in "Testing" publishing
status, Google expires refresh tokens after 7 days, with no warning and no
distinguishing error. Set the consent screen to "In production" — the app can
stay Internal/unverified, publishing status is a separate control from
verification. This is the single most common recurring failure with this setup.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

from therr_ads.settings import DEFAULT_CONFIG_PATH, SettingsError

# The only scope the Google Ads API accepts. Requesting more (analytics, drive)
# widens the consent screen for no benefit and can trip verification review.
SCOPES = ["https://www.googleapis.com/auth/adwords"]


def _load_config(config_path: Path) -> dict:
    if not config_path.exists():
        raise SettingsError(
            f"{config_path} not found. Copy config.example.yaml to config.yaml and fill in "
            "developer_token, client_id, client_secret and login_customer_id first — "
            "`auth login` fills in the one remaining field, refresh_token."
        )
    data = yaml.safe_load(config_path.read_text()) or {}
    if not isinstance(data, dict):
        raise SettingsError(f"{config_path} did not parse to a mapping.")
    return data


def _placeholder(value) -> bool:
    return not value or str(value).startswith("INSERT_")


def run_login(config_path: Path | None = None, no_browser: bool = False, write: bool = True) -> str:
    """Run the installed-app OAuth flow and return the refresh token."""
    config_path = config_path or DEFAULT_CONFIG_PATH
    config = _load_config(config_path)

    missing = [k for k in ("client_id", "client_secret") if _placeholder(config.get(k))]
    if missing:
        raise SettingsError(
            f"{config_path} is missing {', '.join(missing)}. Create an OAuth client of type "
            "'Desktop app' in Google Cloud Console -> APIs & Services -> Credentials, then paste "
            "the id and secret into config.yaml. A 'Web application' client will fail this flow "
            "with redirect_uri_mismatch."
        )

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as exc:  # pragma: no cover - environment problem, not logic
        raise SettingsError(
            "google-auth-oauthlib is not installed. Run: pip install -r requirements.txt"
        ) from exc

    client_config = {
        "installed": {
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            # Loopback. Google disallowed the out-of-band (urn:ietf:wg:oauth:2.0:oob)
            # flow in 2022; --no-browser below uses a local server on a fixed port
            # that you forward, not OOB.
            "redirect_uris": ["http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES)

    # access_type=offline is what makes Google return a refresh token at all.
    # prompt=consent forces a NEW refresh token even if this account has already
    # granted the scope — without it a re-run returns only an access token and
    # the flow appears to succeed while producing nothing usable.
    kwargs = {"access_type": "offline", "prompt": "consent"}

    if no_browser:
        print(
            "\nHeadless mode: a local server will listen on port 8765.\n"
            "If you are on a remote machine, forward it first:\n"
            "    ssh -L 8765:localhost:8765 <this-host>\n"
            "then open the URL below in the browser on your laptop.\n",
            file=sys.stderr,
        )
        credentials = flow.run_local_server(port=8765, open_browser=False, **kwargs)
    else:
        credentials = flow.run_local_server(port=0, **kwargs)

    refresh_token = credentials.refresh_token
    if not refresh_token:
        raise SettingsError(
            "Google returned no refresh token. This happens when the account has already granted "
            "consent and prompt=consent was not honoured. Revoke this app's access at "
            "https://myaccount.google.com/permissions and run `./therrads auth login` again."
        )

    if write:
        _write_refresh_token(config_path, refresh_token)
        print(f"\nRefresh token written to {config_path}.")
    else:
        print(f"\nrefresh_token: {refresh_token}")

    print(
        "\nNext: set the OAuth consent screen to 'In production' in Google Cloud Console\n"
        "(APIs & Services -> OAuth consent screen). While it is in 'Testing', this token\n"
        "expires in 7 days.\n\nThen verify end to end:  ./therrads auth check"
    )
    return refresh_token


def _write_refresh_token(config_path: Path, refresh_token: str) -> None:
    """Rewrite only the refresh_token line, preserving comments.

    yaml.safe_load + yaml.dump would round-trip the file and silently delete
    every comment in config.example.yaml's derived config.yaml — which is where
    the explanation of each credential lives. So this edits the line in place
    and only falls back to appending when the key is genuinely absent.
    """
    text = config_path.read_text()
    lines = text.splitlines()
    replaced = False
    for i, line in enumerate(lines):
        if line.lstrip().startswith("refresh_token:") and not line.lstrip().startswith("#"):
            lines[i] = f'refresh_token: "{refresh_token}"'
            replaced = True
            break
    if not replaced:
        lines.append(f'refresh_token: "{refresh_token}"')
    config_path.write_text("\n".join(lines) + "\n")


def describe_config(config_path: Path | None = None) -> list[str]:
    """Report which credentials are present, without printing their values."""
    config_path = config_path or DEFAULT_CONFIG_PATH
    config = _load_config(config_path)
    rows = []
    for key in ("developer_token", "client_id", "client_secret", "refresh_token", "login_customer_id"):
        value = config.get(key)
        if _placeholder(value):
            rows.append(f"  [MISSING] {key}")
        else:
            shown = str(value)
            masked = shown if key == "login_customer_id" else f"{shown[:6]}...{shown[-4:]}"
            rows.append(f"  [ok]      {key} = {masked}")
    return rows
