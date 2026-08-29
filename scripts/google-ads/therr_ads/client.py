"""GoogleAdsClient construction and error translation.

Isolated in one module so that every other module can be imported and unit
tested without the google-ads package installed — the analysis, spec and
work-item layers hold the logic worth testing, and none of them need credentials.
"""

from __future__ import annotations

from pathlib import Path

from therr_ads.settings import DEFAULT_CONFIG_PATH, SettingsError

# Google Ads error codes that mean something specific and actionable. The API's
# own message for each is accurate but assumes you know the domain; these add
# the fix. Extend this map whenever a run costs you more than five minutes.
ERROR_HINTS = {
    "DEVELOPER_TOKEN_NOT_APPROVED": (
        "Your developer token is still at Test Account access level and cannot touch a real "
        "account. Apply for Basic access: Google Ads UI -> Tools & Settings -> Setup -> API Center."
    ),
    "DEVELOPER_TOKEN_PROHIBITED": (
        "The developer token is not permitted for this API. Confirm it came from the API Center of "
        "the MANAGER account named in config.yaml -> login_customer_id."
    ),
    "USER_PERMISSION_DENIED": (
        "The authenticated Google account cannot reach this customer id. Two usual causes: "
        "settings.yaml -> customer_id is not under config.yaml -> login_customer_id, or you "
        "authorised the wrong Google account during `auth login`. Run `./therrads auth check` to "
        "list what this refresh token can actually see."
    ),
    "CUSTOMER_NOT_ENABLED": (
        "The Ads account exists but is not activated — it has no billing set up. Add a payment "
        "method in the Google Ads UI. Campaigns can be created but will never serve until then."
    ),
    "AUTHENTICATION_ERROR": (
        "The refresh token is invalid or expired. If it worked previously, the Cloud project's "
        "OAuth consent screen is probably still in 'Testing' status, which expires refresh tokens "
        "after 7 days. Set it to 'In production', then re-run `./therrads auth login`."
    ),
    "RESOURCE_EXHAUSTED": (
        "Rate limited. The Google Ads API allows far fewer operations than it looks like; back off "
        "and retry in a minute. If this is a report loop, widen the date range instead of "
        "requesting day by day."
    ),
}


class AdsClientError(RuntimeError):
    pass


def build_client(config_path: Path | None = None):
    """Construct a GoogleAdsClient from config.yaml.

    Env vars win when present (GOOGLE_ADS_DEVELOPER_TOKEN and friends), which is
    how CI or a one-off run against a different account works without editing
    the file — but the file is the documented path.
    """
    config_path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH

    try:
        from google.ads.googleads.client import GoogleAdsClient
    except ImportError as exc:
        raise SettingsError(
            "The google-ads package is not installed. From scripts/google-ads:\n"
            "    python3 -m venv .venv && . .venv/bin/activate\n"
            "    pip install -r requirements.txt"
        ) from exc

    import os

    if os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN") and os.environ.get("GOOGLE_ADS_REFRESH_TOKEN"):
        return GoogleAdsClient.load_from_env()

    if not config_path.exists():
        raise SettingsError(
            f"{config_path} not found. Copy config.example.yaml to config.yaml, fill in the four "
            "credentials it documents, then run `./therrads auth login`."
        )

    return GoogleAdsClient.load_from_storage(str(config_path))


def explain(exception) -> str:
    """Turn a GoogleAdsException into something that names the fix.

    The raw exception prints a request id and a nested failure proto; the error
    code is in there but buried under three levels of repeated fields.
    """
    parts: list[str] = []
    failure = getattr(exception, "failure", None)
    if failure is None:
        return str(exception)

    request_id = getattr(exception, "request_id", None)
    if request_id:
        parts.append(f"request_id: {request_id}")

    for error in getattr(failure, "errors", []):
        message = getattr(error, "message", "")
        code_obj = getattr(error, "error_code", None)
        code_name = ""
        if code_obj is not None:
            # error_code is a oneof: exactly one field is set, and its VALUE is
            # the enum member we want to key hints on.
            for field_descriptor, value in getattr(code_obj, "ListFields", lambda: [])():
                code_name = getattr(value, "name", str(value))
                parts.append(f"{field_descriptor.name}: {code_name}")
        else:
            parts.append(message)

        if message:
            parts.append(f"  {message}")
        hint = ERROR_HINTS.get(code_name)
        if hint:
            parts.append(f"  -> {hint}")

        location = getattr(error, "location", None)
        if location is not None:
            path = ".".join(
                str(getattr(el, "field_name", "")) for el in getattr(location, "field_path_elements", [])
            )
            if path:
                parts.append(f"  field: {path}")

    return "\n".join(parts)


def list_accessible_customers(client) -> list[str]:
    """Every customer id this refresh token can reach. The `auth check` payload.

    Returns bare ids. Note this lists accounts the *authenticated user* can
    access, which is not the same as accounts reachable through the configured
    login_customer_id — an id here can still fail with USER_PERMISSION_DENIED if
    it is not under that manager.
    """
    service = client.get_service("CustomerService")
    response = service.list_accessible_customers()
    return [name.split("/")[-1] for name in response.resource_names]
