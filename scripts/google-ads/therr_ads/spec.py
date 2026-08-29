"""Campaign specs: the YAML files in campaigns/ parsed and validated.

A spec is the declarative description of a campaign. `therrads campaign plan`
renders one into the exact mutate operations it would send; `campaign apply`
sends them. Nothing about a campaign is expressed in code — if you want a
different campaign, you write a different YAML file.

TWO ARMS, ON PURPOSE
`kind: app_install` and `kind: web_landing` are not two ways to do the same
thing. They trade volume against measurability:

  app_install  Google App campaign -> Play Store -> com.therr.habits.
               Cheapest installs by a wide margin, and the only realistic way
               to get initial volume. BUT the user never touches a web page we
               control, so `main.userAcquisition` records nothing, and the
               funnel goes dark the moment the install completes. Everything
               downstream of the install is inferred, not measured, until the
               Play Install Referrer is wired up (see CLAUDE.md in this dir).

  web_landing  Search campaign -> habits.therr.com with UTM parameters.
               Several times the cost per signup, and lower ceiling on volume.
               BUT therr-react's attribution utility captures the UTMs at
               registration into main.userAcquisition, so every signup joins to
               its pact activity, its invites and its Founder Unlock purchase.
               This arm is the measuring instrument. It is what makes
               "which market segment actually pays" an answerable question.

Run both. The app arm buys users, the web arm buys knowledge about them. Sizing
them separately is the point of per-spec budgets.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import yaml

# Google Ads text asset limits for App campaigns and RSAs. Enforced here rather
# than discovered at mutate time, because the API rejects the whole operation
# with a field path like `ad.app_ad.headlines[3]` and no character count.
MAX_HEADLINE_CHARS = 30
MAX_DESCRIPTION_CHARS = 90
APP_HEADLINES_RANGE = (2, 5)
APP_DESCRIPTIONS_RANGE = (1, 5)
# Responsive search ads allow far more, but 3 headlines is the practical floor
# for Google to assemble a serving combination.
RSA_HEADLINES_RANGE = (3, 15)
RSA_DESCRIPTIONS_RANGE = (2, 4)

VALID_KINDS = {"app_install", "web_landing"}

# App campaign bidding goals, as named by the API enum
# AppCampaignBiddingStrategyGoalType. Listed explicitly so a typo in YAML fails
# here with the valid set printed, rather than as an opaque enum lookup error.
VALID_APP_GOALS = {
    "OPTIMIZE_INSTALLS_TARGET_INSTALL_COST",
    "OPTIMIZE_INSTALLS_WITHOUT_TARGET_INSTALL_COST",
    "OPTIMIZE_IN_APP_CONVERSIONS_TARGET_INSTALL_COST",
    "OPTIMIZE_IN_APP_CONVERSIONS_TARGET_CONVERSION_COST",
    "OPTIMIZE_RETURN_ON_ADVERTISING_SPEND",
    "OPTIMIZE_PRE_REGISTRATION_CONVERSION_VOLUME",
}


class SpecError(ValueError):
    """A spec file is invalid. Message names the file and the field."""


@dataclass
class Budget:
    daily: Decimal
    currency: str = "USD"
    # Google may spend up to 2x the daily budget on a high-traffic day, balanced
    # over the month. ACCELERATED delivery is deprecated for most campaign types;
    # STANDARD is the only value that behaves predictably.
    delivery: str = "STANDARD"
    # Reuse an existing shared budget instead of creating one. Empty = create.
    shared_budget_resource: str = ""


@dataclass
class Bidding:
    goal: str = "OPTIMIZE_INSTALLS_TARGET_INSTALL_COST"
    target_cpa: Decimal | None = None
    target_roas: Decimal | None = None


@dataclass
class Targeting:
    # Geo target constant IDs. 2840 = United States. Resolve names to IDs with
    # `therrads geo lookup "Chicago, Illinois"`.
    location_ids: list[str] = field(default_factory=list)
    # Language constant IDs. 1000 = English, 1003 = Spanish, 1002 = French.
    language_ids: list[str] = field(default_factory=lambda: ["1000"])
    # Human-readable echo of the above, for the plan output and the docs. Never
    # sent to the API — the IDs are authoritative.
    notes: str = ""


@dataclass
class AdGroup:
    """web_landing only. App campaigns have exactly one implicit ad group."""

    name: str
    keywords: list[str] = field(default_factory=list)
    negative_keywords: list[str] = field(default_factory=list)
    match_type: str = "PHRASE"
    final_url: str = ""


@dataclass
class Assets:
    headlines: list[str] = field(default_factory=list)
    descriptions: list[str] = field(default_factory=list)
    # Local paths or existing asset resource names. App campaigns serve far
    # better with at least one portrait video; without video Google restricts
    # inventory to Search and a slice of Display.
    images: list[str] = field(default_factory=list)
    videos: list[str] = field(default_factory=list)


@dataclass
class Tracking:
    """UTM parameters appended to the final URL (web_landing only).

    These strings are the join key between Google Ads and the product database:
    they land in main.userAcquisition.utmCampaign at registration, and every
    downstream funnel query in product.py groups by that column. Change one and
    the historical series breaks — treat a campaign's utm_campaign as immutable
    once it has served, and start a new campaign instead of renaming.
    """

    utm_source: str = "google"
    utm_medium: str = "cpc"
    utm_campaign: str = ""
    utm_content: str = ""
    # ValueTrack parameters Google substitutes at click time. keyword and
    # matchtype are what make the search-term analysis in analysis.py possible.
    value_track: dict = field(default_factory=lambda: {
        "utm_term": "{keyword}",
        "gad_matchtype": "{matchtype}",
        "gad_network": "{network}",
        "gad_device": "{device}",
    })

    def final_url_suffix(self) -> str:
        pairs = [
            ("utm_source", self.utm_source),
            ("utm_medium", self.utm_medium),
            ("utm_campaign", self.utm_campaign),
        ]
        if self.utm_content:
            pairs.append(("utm_content", self.utm_content))
        pairs.extend(sorted(self.value_track.items()))
        return "&".join(f"{k}={v}" for k, v in pairs if v)


@dataclass
class CampaignSpec:
    name: str
    kind: str
    budget: Budget
    bidding: Bidding
    targeting: Targeting
    assets: Assets
    tracking: Tracking
    app_id: str = ""
    app_store: str = "GOOGLE_APP_STORE"
    # PAUSED is the default in every shipped spec. A campaign created ENABLED
    # starts spending the moment the mutate returns, before anyone has looked at
    # what was actually created.
    status: str = "PAUSED"
    start_date: str = ""
    end_date: str = ""
    ad_groups: list[AdGroup] = field(default_factory=list)
    hypothesis: str = ""
    source_path: Path | None = None
    # Populated by load_spec. Advisory only — printed on plan/apply, never blocking.
    warnings: list[str] = field(default_factory=list)

    @property
    def is_app(self) -> bool:
        return self.kind == "app_install"


def _decimal(value, field_name: str) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception as exc:  # noqa: BLE001 - message needs the field name
        raise SpecError(f"{field_name}: not a number ({value!r})") from exc


def load_spec(path: Path | str) -> CampaignSpec:
    """Parse and fully validate a campaign spec. Raises SpecError with the fix."""
    path = Path(path)
    if not path.exists():
        raise SpecError(f"spec not found: {path}")

    raw = yaml.safe_load(path.read_text()) or {}
    if not isinstance(raw, dict):
        raise SpecError(f"{path}: did not parse to a mapping.")

    campaign = raw.get("campaign") or {}
    kind = str(campaign.get("kind", "")).strip()
    if kind not in VALID_KINDS:
        raise SpecError(f"{path}: campaign.kind must be one of {sorted(VALID_KINDS)}, got {kind!r}.")

    budget_raw = raw.get("budget") or {}
    if "daily" not in budget_raw:
        raise SpecError(f"{path}: budget.daily is required.")

    bidding_raw = raw.get("bidding") or {}
    targeting_raw = raw.get("targeting") or {}
    assets_raw = raw.get("assets") or {}
    tracking_raw = raw.get("tracking") or {}

    spec = CampaignSpec(
        name=str(campaign.get("name", "")).strip(),
        kind=kind,
        app_id=str(campaign.get("app_id", "")).strip(),
        app_store=str(campaign.get("app_store", "GOOGLE_APP_STORE")),
        status=str(campaign.get("status", "PAUSED")).upper(),
        start_date=str(campaign.get("start_date", "")),
        end_date=str(campaign.get("end_date", "")),
        hypothesis=str(raw.get("hypothesis", "")).strip(),
        budget=Budget(
            daily=_decimal(budget_raw["daily"], "budget.daily"),
            currency=str(budget_raw.get("currency", "USD")),
            delivery=str(budget_raw.get("delivery", "STANDARD")).upper(),
            shared_budget_resource=str(budget_raw.get("shared_budget_resource", "")),
        ),
        bidding=Bidding(
            goal=str(bidding_raw.get("goal", "OPTIMIZE_INSTALLS_TARGET_INSTALL_COST")).upper(),
            target_cpa=_decimal(bidding_raw["target_cpa"], "bidding.target_cpa")
            if bidding_raw.get("target_cpa") is not None
            else None,
            target_roas=_decimal(bidding_raw["target_roas"], "bidding.target_roas")
            if bidding_raw.get("target_roas") is not None
            else None,
        ),
        targeting=Targeting(
            location_ids=[str(v) for v in (targeting_raw.get("location_ids") or [])],
            language_ids=[str(v) for v in (targeting_raw.get("language_ids") or ["1000"])],
            notes=str(targeting_raw.get("notes", "")),
        ),
        assets=Assets(
            headlines=[str(v) for v in (assets_raw.get("headlines") or [])],
            descriptions=[str(v) for v in (assets_raw.get("descriptions") or [])],
            images=[str(v) for v in (assets_raw.get("images") or [])],
            videos=[str(v) for v in (assets_raw.get("videos") or [])],
        ),
        tracking=Tracking(
            utm_source=str(tracking_raw.get("utm_source", "google")),
            utm_medium=str(tracking_raw.get("utm_medium", "cpc")),
            utm_campaign=str(tracking_raw.get("utm_campaign", "")),
            utm_content=str(tracking_raw.get("utm_content", "")),
            value_track=tracking_raw.get("value_track") or Tracking().value_track,
        ),
        ad_groups=[
            AdGroup(
                name=str(g.get("name", "")),
                keywords=[str(k) for k in (g.get("keywords") or [])],
                negative_keywords=[str(k) for k in (g.get("negative_keywords") or [])],
                match_type=str(g.get("match_type", "PHRASE")).upper(),
                final_url=str(g.get("final_url", "")),
            )
            for g in (raw.get("ad_groups") or [])
        ],
        source_path=path,
    )

    errors, warnings = validate_spec(spec)
    if errors:
        joined = "\n  - ".join(errors)
        raise SpecError(f"{path} is invalid:\n  - {joined}")
    spec.warnings = warnings
    return spec


def validate_spec(spec: CampaignSpec) -> tuple[list[str], list[str]]:
    """Return (errors, warnings) for a spec, listing every problem, not the first.

    Returning lists matters: fixing one asset length at a time across five round
    trips to the API is the slow path this function exists to replace.

    ERRORS are structural — the API would reject the mutate, or the campaign
    would be unmeasurable. They block `campaign apply`.
    WARNINGS are judgement calls that a competent operator may knowingly accept
    (no video assets yet, a target CPA below the budget ratio). They print on
    every plan and apply, and never block.
    """
    errors: list[str] = []
    warnings: list[str] = []

    if not spec.name:
        errors.append("campaign.name is required (it is also the reporting key — keep it stable).")
    if spec.status not in {"PAUSED", "ENABLED"}:
        errors.append(f"campaign.status must be PAUSED or ENABLED, got {spec.status!r}.")
    if spec.budget.daily <= 0:
        errors.append("budget.daily must be greater than zero.")
    if spec.budget.delivery not in {"STANDARD", "ACCELERATED"}:
        errors.append("budget.delivery must be STANDARD (recommended) or ACCELERATED.")
    if not spec.targeting.location_ids:
        errors.append(
            "targeting.location_ids is required — an untargeted campaign serves worldwide and "
            "burns the budget in the cheapest-click markets. Resolve IDs with `therrads geo lookup`."
        )

    for label, value in (("start_date", spec.start_date), ("end_date", spec.end_date)):
        if value:
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError:
                errors.append(f"campaign.{label} must be YYYY-MM-DD, got {value!r}.")
    if spec.start_date and spec.end_date and spec.start_date > spec.end_date:
        errors.append("campaign.end_date is before campaign.start_date.")

    if spec.is_app:
        app_errors, app_warnings = _validate_app(spec)
        errors.extend(app_errors)
        warnings.extend(app_warnings)
    else:
        web_errors, web_warnings = _validate_web(spec)
        errors.extend(web_errors)
        warnings.extend(web_warnings)

    errors.extend(_validate_text_assets(spec))
    return errors, warnings


def _validate_app(spec: CampaignSpec) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not spec.app_id:
        errors.append("campaign.app_id is required for kind: app_install (e.g. com.therr.habits).")
    if spec.app_store not in {"GOOGLE_APP_STORE", "APPLE_APP_STORE"}:
        errors.append("campaign.app_store must be GOOGLE_APP_STORE or APPLE_APP_STORE.")
    if spec.bidding.goal not in VALID_APP_GOALS:
        errors.append(f"bidding.goal must be one of {sorted(VALID_APP_GOALS)}, got {spec.bidding.goal!r}.")
    if spec.bidding.goal.endswith("TARGET_INSTALL_COST") and spec.bidding.target_cpa is None:
        errors.append(f"bidding.target_cpa is required when bidding.goal is {spec.bidding.goal}.")
    if spec.bidding.goal == "OPTIMIZE_RETURN_ON_ADVERTISING_SPEND" and spec.bidding.target_roas is None:
        errors.append("bidding.target_roas is required for OPTIMIZE_RETURN_ON_ADVERTISING_SPEND.")
    if spec.ad_groups:
        errors.append(
            "ad_groups are not configurable on App campaigns — Google creates and manages the single "
            "ad group itself. Remove the ad_groups block, or change kind to web_landing."
        )
    if spec.bidding.goal.startswith("OPTIMIZE_IN_APP_CONVERSIONS"):
        warnings.append(
            "bidding.goal targets in-app conversions, which requires a Firebase or Google Play "
            "conversion action already receiving events. Until that is wired (see this directory's "
            "CLAUDE.md § The attribution gap), start on OPTIMIZE_INSTALLS_TARGET_INSTALL_COST — "
            "in-app-conversion bidding with no conversion signal simply does not serve."
        )
    if not spec.assets.videos:
        warnings.append(
            "assets.videos is empty. Not fatal, but App campaigns without a video are limited to "
            "Search and a narrow Display slice: expect a fraction of the reach at a higher CPI. "
            "A single 15-30s portrait clip is the highest-leverage asset here."
        )
    if spec.assets.images or spec.assets.videos:
        # Image and video assets need a separate AssetService upload of the binary
        # before an ad can reference them, which this tool does not do. Say so
        # here rather than letting `apply` drop them silently — the plan counts
        # them, so an operator who filled the list in would otherwise believe
        # they had shipped.
        warnings.append(
            f"assets.images ({len(spec.assets.images)}) and assets.videos "
            f"({len(spec.assets.videos)}) are NOT uploaded by this tool — only text assets are "
            "sent. Attach the media to the created campaign in the Google Ads UI, or the app ad "
            "will serve text-only."
        )
    return errors, warnings


def _validate_web(spec: CampaignSpec) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not spec.ad_groups:
        errors.append("kind: web_landing requires at least one ad_groups entry with keywords.")
    if not spec.tracking.utm_campaign:
        errors.append(
            "tracking.utm_campaign is required for kind: web_landing. Without it the signups this "
            "campaign produces land in main.userAcquisition with a NULL utmCampaign and cannot be "
            "attributed to the spend that produced them — which is the entire purpose of this arm."
        )
    for group in spec.ad_groups:
        if not group.name:
            errors.append("every ad_groups entry needs a name.")
        if not group.keywords:
            errors.append(f"ad group {group.name!r} has no keywords.")
        if group.match_type not in {"EXACT", "PHRASE", "BROAD"}:
            errors.append(f"ad group {group.name!r}: match_type must be EXACT, PHRASE or BROAD.")
        if group.match_type == "BROAD" and not group.negative_keywords:
            warnings.append(
                f"ad group {group.name!r} uses BROAD match with no negative_keywords. Broad match on a "
                "small budget reliably spends it on adjacent intent (free templates, addiction "
                "recovery, fitness gear). Add negatives or use PHRASE."
            )
        url = group.final_url
        if not url:
            errors.append(f"ad group {group.name!r}: final_url is required.")
        elif not url.startswith("https://"):
            errors.append(f"ad group {group.name!r}: final_url must be https, got {url!r}.")
        elif "?" in url:
            errors.append(
                f"ad group {group.name!r}: final_url must not carry a query string — the UTMs come "
                "from tracking.* as a final URL suffix. A query string here duplicates them and "
                "Google drops one of the two sets unpredictably."
            )
    return errors, warnings


def _validate_text_assets(spec: CampaignSpec) -> list[str]:
    errors: list[str] = []
    if spec.is_app:
        h_range, d_range = APP_HEADLINES_RANGE, APP_DESCRIPTIONS_RANGE
    else:
        h_range, d_range = RSA_HEADLINES_RANGE, RSA_DESCRIPTIONS_RANGE

    n_head = len(spec.assets.headlines)
    if not h_range[0] <= n_head <= h_range[1]:
        errors.append(f"assets.headlines: need {h_range[0]}-{h_range[1]} for {spec.kind}, got {n_head}.")
    n_desc = len(spec.assets.descriptions)
    if not d_range[0] <= n_desc <= d_range[1]:
        errors.append(f"assets.descriptions: need {d_range[0]}-{d_range[1]} for {spec.kind}, got {n_desc}.")

    for i, text in enumerate(spec.assets.headlines):
        if len(text) > MAX_HEADLINE_CHARS:
            errors.append(
                f"assets.headlines[{i}] is {len(text)} chars, max {MAX_HEADLINE_CHARS}: {text!r}"
            )
    for i, text in enumerate(spec.assets.descriptions):
        if len(text) > MAX_DESCRIPTION_CHARS:
            errors.append(
                f"assets.descriptions[{i}] is {len(text)} chars, max {MAX_DESCRIPTION_CHARS}: {text!r}"
            )

    duplicates = {t for t in spec.assets.headlines if spec.assets.headlines.count(t) > 1}
    if duplicates:
        errors.append(f"assets.headlines contains duplicates (Google rejects these): {sorted(duplicates)}")

    return errors


def today_iso() -> str:
    return date.today().strftime("%Y-%m-%d")
