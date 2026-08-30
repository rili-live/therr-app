"""Loads settings.yaml (ours) and locates config.yaml (the library's).

Deliberately separate from the google-ads credential file — see the header of
config.example.yaml for why.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

import yaml

from therr_ads.money import BudgetLimits

PACKAGE_ROOT = Path(__file__).resolve().parent.parent

DEFAULT_CONFIG_PATH = PACKAGE_ROOT / "config.yaml"
DEFAULT_SETTINGS_PATH = PACKAGE_ROOT / "settings.yaml"


class SettingsError(RuntimeError):
    """Configuration is missing or unusable. Always carries the fix in the message."""


@dataclass
class Ga4Settings:
    property_id: str = ""
    crawler_guard: bool = True
    surface_dimension_registered: bool = False


@dataclass
class ProductDbSettings:
    enabled: bool = False
    host_env: str = "DB_HOST_MAIN_READ"
    port_env: str = "DB_PORT_MAIN_READ"
    user_env: str = "DB_USER_MAIN_READ"
    password_env: str = "DB_PASSWORD_MAIN_READ"
    database_env: str = "USERS_SERVICE_DATABASE"
    brand_variation: str = "habits"

    def dsn(self) -> str:
        """Build a libpq DSN from the repo's existing env var names.

        Reuses the users-service READ replica variables so anyone who can
        already run the repo's TS scripts can run this with no new setup. READ,
        never WRITE: this tool has no business writing to the product database.
        """
        missing = [
            name
            for name in (self.host_env, self.user_env, self.password_env, self.database_env)
            if not os.environ.get(name)
        ]
        if missing:
            raise SettingsError(
                "product_db is enabled but these env vars are unset: "
                + ", ".join(missing)
                + ". Source the repo .env (see docs/SECRETS_AND_LOCAL_BOOTSTRAP.md), or set "
                "product_db.enabled: false in settings.yaml to run on Ads + GA4 data only."
            )
        return " ".join(
            f"{key}={_quote_conninfo(value)}"
            for key, value in (
                ("host", os.environ[self.host_env]),
                ("port", os.environ.get(self.port_env) or "5432"),
                ("user", os.environ[self.user_env]),
                ("password", os.environ[self.password_env]),
                ("dbname", os.environ[self.database_env]),
            )
        )


def _quote_conninfo(value: str) -> str:
    """Quote one value for a libpq keyword/value connection string.

    libpq splits a conninfo string on whitespace, so a password containing a
    space silently truncates the password and turns the remainder into a
    garbage keyword — the connection then fails with an authentication error
    that points at the wrong thing entirely. Empty values have the same
    problem. libpq's rule: wrap in single quotes, and backslash-escape any
    single quote or backslash inside.
    """
    escaped = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


@dataclass
class Targets:
    """The campaign's definition of success. The analyzer judges against these."""

    max_cpi: Decimal = Decimal("3.00")
    max_cost_per_signup: Decimal = Decimal("12.00")
    min_install_to_signup_rate: Decimal = Decimal("0.25")
    min_signup_to_pact_rate: Decimal = Decimal("0.30")
    min_signup_to_unlock_rate: Decimal = Decimal("0.10")
    min_activation_to_payer_rate: Decimal = Decimal("0.02")
    min_conversions_for_verdict: int = 30

    @classmethod
    def from_dict(cls, raw: dict | None) -> "Targets":
        raw = raw or {}
        defaults = cls()
        kwargs = {}
        for name, default in vars(defaults).items():
            value = raw.get(name, default)
            kwargs[name] = int(value) if isinstance(default, int) else Decimal(str(value))
        return cls(**kwargs)


@dataclass
class Settings:
    customer_id: str = ""
    limits: BudgetLimits = field(default_factory=BudgetLimits)
    ga4: Ga4Settings = field(default_factory=Ga4Settings)
    product_db: ProductDbSettings = field(default_factory=ProductDbSettings)
    targets: Targets = field(default_factory=Targets)
    outputs: dict = field(default_factory=dict)
    config_path: Path = DEFAULT_CONFIG_PATH
    settings_path: Path = DEFAULT_SETTINGS_PATH

    def resolved_output(self, key: str) -> Path:
        """Resolve an outputs.* path relative to scripts/google-ads/."""
        raw = self.outputs.get(key)
        if not raw:
            raise SettingsError(f"settings.yaml -> outputs.{key} is not set.")
        candidate = Path(raw)
        return candidate if candidate.is_absolute() else (PACKAGE_ROOT / candidate).resolve()

    def require_customer_id(self) -> str:
        digits = "".join(ch for ch in str(self.customer_id) if ch.isdigit())
        if not digits:
            raise SettingsError(
                "settings.yaml -> customer_id is not set. This is the Google Ads account "
                "campaigns are created in, digits only (123-456-7890 -> 1234567890). Run "
                "`./therrads auth check` to list the accounts your refresh token can reach."
            )
        return digits


def load_settings(path: Path | str | None = None) -> Settings:
    settings_path = Path(path) if path else DEFAULT_SETTINGS_PATH
    if not settings_path.exists():
        raise SettingsError(
            f"{settings_path} not found. Copy settings.example.yaml to settings.yaml and fill it in, "
            "or run `./therrads config init` to generate both files interactively."
        )

    raw = yaml.safe_load(settings_path.read_text()) or {}
    if not isinstance(raw, dict):
        raise SettingsError(f"{settings_path} did not parse to a mapping.")

    ga4_raw = raw.get("ga4") or {}
    product_raw = raw.get("product_db") or {}

    return Settings(
        customer_id=str(raw.get("customer_id", "")),
        limits=BudgetLimits.from_dict(raw.get("limits")),
        ga4=Ga4Settings(
            property_id=str(ga4_raw.get("property_id", "")),
            crawler_guard=bool(ga4_raw.get("crawler_guard", True)),
            surface_dimension_registered=bool(ga4_raw.get("surface_dimension_registered", False)),
        ),
        product_db=ProductDbSettings(
            enabled=bool(product_raw.get("enabled", False)),
            host_env=product_raw.get("host_env", "DB_HOST_MAIN_READ"),
            port_env=product_raw.get("port_env", "DB_PORT_MAIN_READ"),
            user_env=product_raw.get("user_env", "DB_USER_MAIN_READ"),
            password_env=product_raw.get("password_env", "DB_PASSWORD_MAIN_READ"),
            database_env=product_raw.get("database_env", "USERS_SERVICE_DATABASE"),
            brand_variation=product_raw.get("brand_variation", "habits"),
        ),
        targets=Targets.from_dict(raw.get("targets")),
        outputs=raw.get("outputs") or {},
        settings_path=settings_path,
    )
