"""Create and manage campaigns from a spec.

THE PLAN/APPLY SPLIT
Every mutation goes through two phases. `plan` builds the full operation list
and renders it as text without opening a connection. `apply` builds the SAME
list and sends it. There is no code path that mutates without a plan being
constructible, and `apply` refuses without --confirm. This is a tool that spends
money on a live account from a terminal; the ceremony is the point.

TEMP RESOURCE NAMES
A campaign needs a budget's resource name, and an ad group needs a campaign's,
but all three are created in one atomic mutate. Google Ads solves this with
negative temporary ids: a budget created as `customers/X/campaignBudgets/-1` can
be referenced by the campaign in the same request. The ids must be negative and
unique within the request. Counting down from -1 is the convention.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from therr_ads.money import BudgetDecision, check_budget, format_micros, to_micros
from therr_ads.settings import Settings
from therr_ads.spec import CampaignSpec


@dataclass
class PlannedChange:
    """One line of the human-readable plan."""

    action: str      # CREATE | UPDATE | PAUSE | RESUME
    entity: str      # CampaignBudget | Campaign | AdGroup | AdGroupAd | AdGroupCriterion
    name: str
    detail: str = ""

    def render(self) -> str:
        suffix = f"  {self.detail}" if self.detail else ""
        return f"  {self.action:<7} {self.entity:<18} {self.name}{suffix}"


@dataclass
class Plan:
    spec: CampaignSpec
    changes: list[PlannedChange] = field(default_factory=list)
    budget_decision: BudgetDecision | None = None
    warnings: list[str] = field(default_factory=list)
    blockers: list[str] = field(default_factory=list)

    @property
    def can_apply(self) -> bool:
        return not self.blockers

    def render(self) -> str:
        spec = self.spec
        lines = [
            "",
            f"CAMPAIGN PLAN — {spec.name}",
            f"  spec:      {spec.source_path}",
            f"  kind:      {spec.kind}",
            f"  status:    {spec.status}  (created paused unless the spec says otherwise)",
            f"  budget:    {spec.budget.daily} {spec.budget.currency}/day"
            f" = {format_micros(to_micros(spec.budget.daily), spec.budget.currency)}",
            f"  bidding:   {spec.bidding.goal}"
            + (f" @ target CPA {spec.bidding.target_cpa}" if spec.bidding.target_cpa else ""),
            f"  targeting: locations={spec.targeting.location_ids} languages={spec.targeting.language_ids}",
        ]
        if spec.kind == "web_landing":
            lines.append(f"  final URL suffix: {spec.tracking.final_url_suffix()}")
        if spec.hypothesis:
            lines += ["", "  HYPOTHESIS UNDER TEST:"]
            lines += [f"    {line}" for line in _wrap(spec.hypothesis, 88)]

        lines += ["", f"OPERATIONS ({len(self.changes)}):"]
        lines += [c.render() for c in self.changes]

        if self.warnings:
            lines += ["", "WARNINGS (advisory — apply will proceed):"]
            lines += [f"  ! {line}" for w in self.warnings for line in _wrap(w, 96)]

        if self.blockers:
            lines += ["", "BLOCKED (apply will refuse):"]
            lines += [f"  x {line}" for b in self.blockers for line in _wrap(b, 96)]
        else:
            lines += ["", "Nothing sent. To execute:",
                      f"  ./therrads campaign apply {spec.source_path} --confirm"]
        return "\n".join(lines) + "\n"


def _wrap(text: str, width: int) -> list[str]:
    import textwrap

    return textwrap.wrap(" ".join(text.split()), width=width) or [""]


def build_plan(
    spec: CampaignSpec,
    settings: Settings,
    other_campaigns_micros: int = 0,
) -> Plan:
    """Render a spec into the operations that would be sent. No network calls."""
    plan = Plan(spec=spec, warnings=list(spec.warnings))

    decision = check_budget(
        spec.budget.daily,
        settings.limits,
        current_micros=None,
        other_campaigns_micros=other_campaigns_micros,
        target_cpa=spec.bidding.target_cpa,
    )
    plan.budget_decision = decision
    plan.warnings.extend(decision.warnings)
    plan.blockers.extend(decision.blocked)

    budget_name = f"{spec.name} — daily budget"
    plan.changes.append(
        PlannedChange(
            "CREATE",
            "CampaignBudget",
            budget_name,
            f"{spec.budget.daily} {spec.budget.currency}/day, {spec.budget.delivery}, not shared",
        )
    )
    plan.changes.append(
        PlannedChange(
            "CREATE",
            "Campaign",
            spec.name,
            f"{'APP / MULTI_CHANNEL' if spec.is_app else 'SEARCH'}, status={spec.status}",
        )
    )

    for location_id in spec.targeting.location_ids:
        plan.changes.append(
            PlannedChange("CREATE", "CampaignCriterion", f"geo:{location_id}", "location target")
        )
    for language_id in spec.targeting.language_ids:
        plan.changes.append(
            PlannedChange("CREATE", "CampaignCriterion", f"lang:{language_id}", "language target")
        )

    if spec.is_app:
        plan.changes.append(
            PlannedChange(
                "CREATE",
                "AdGroup",
                f"{spec.name} — ad group",
                "App campaigns allow exactly one; Google manages it",
            )
        )
        plan.changes.append(
            PlannedChange(
                "CREATE",
                "AdGroupAd",
                "app ad",
                f"{len(spec.assets.headlines)} headlines, {len(spec.assets.descriptions)} descriptions, "
                f"{len(spec.assets.images)} images, {len(spec.assets.videos)} videos",
            )
        )
    else:
        for group in spec.ad_groups:
            plan.changes.append(
                PlannedChange("CREATE", "AdGroup", group.name, f"final_url={group.final_url}")
            )
            plan.changes.append(
                PlannedChange(
                    "CREATE",
                    "AdGroupAd",
                    f"{group.name} / RSA",
                    f"{len(spec.assets.headlines)} headlines, {len(spec.assets.descriptions)} descriptions",
                )
            )
            for keyword in group.keywords:
                plan.changes.append(
                    PlannedChange("CREATE", "AdGroupCriterion", f"+{keyword}", group.match_type)
                )
            for keyword in group.negative_keywords:
                plan.changes.append(
                    PlannedChange("CREATE", "AdGroupCriterion", f"-{keyword}", "NEGATIVE BROAD")
                )

    return plan


# ---------------------------------------------------------------------------
# Apply. Everything below needs the google-ads package and live credentials.
# ---------------------------------------------------------------------------


def apply_plan(client, customer_id: str, spec: CampaignSpec) -> dict:
    """Send the spec as one atomic mutate. Returns created resource names.

    Atomic on purpose: a partial apply leaves a campaign with a budget and no
    ads, which serves nothing but is easy to mistake for a working campaign.
    """
    service = client.get_service("GoogleAdsService")
    operations = []
    temp_id = _TempIds(client, customer_id)

    budget_resource = temp_id.next("campaignBudget")
    operations.append(_budget_operation(client, customer_id, spec, budget_resource))

    campaign_resource = temp_id.next("campaign")
    operations.append(_campaign_operation(client, customer_id, spec, budget_resource, campaign_resource))

    operations.extend(_criteria_operations(client, customer_id, spec, campaign_resource))

    if spec.is_app:
        ad_group_resource = temp_id.next("adGroup")
        operations.append(
            _app_ad_group_operation(client, customer_id, spec, campaign_resource, ad_group_resource)
        )
        operations.append(_app_ad_operation(client, customer_id, spec, ad_group_resource))
    else:
        for group in spec.ad_groups:
            ad_group_resource = temp_id.next("adGroup")
            operations.append(
                _search_ad_group_operation(client, customer_id, group, campaign_resource, ad_group_resource)
            )
            operations.append(_rsa_operation(client, customer_id, spec, group, ad_group_resource))
            operations.extend(_keyword_operations(client, customer_id, group, ad_group_resource))

    response = service.mutate(customer_id=customer_id, mutate_operations=operations)
    created = [
        getattr(result, result._pb.WhichOneof("response"), None)
        for result in response.mutate_operation_responses
    ]
    return {
        "campaign_resource_name": campaign_resource,
        "created": [getattr(c, "resource_name", "") for c in created if c is not None],
    }


class _TempIds:
    """Negative temporary resource names, unique within one mutate request."""

    def __init__(self, client, customer_id: str):
        self._client = client
        self._customer_id = customer_id
        self._next = -1

    def next(self, entity: str) -> str:
        service_name = {
            "campaignBudget": "CampaignBudgetService",
            "campaign": "CampaignService",
            "adGroup": "AdGroupService",
        }[entity]
        service = self._client.get_service(service_name)
        path_fn = {
            "campaignBudget": service.campaign_budget_path,
            "campaign": service.campaign_path,
            "adGroup": service.ad_group_path,
        }[entity]
        resource = path_fn(self._customer_id, self._next)
        self._next -= 1
        return resource


def _budget_operation(client, customer_id: str, spec: CampaignSpec, resource_name: str):
    operation = client.get_type("MutateOperation")
    budget = operation.campaign_budget_operation.create
    budget.resource_name = resource_name
    budget.name = f"{spec.name} — daily budget"
    budget.amount_micros = to_micros(spec.budget.daily)
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum[spec.budget.delivery]
    # An App campaign budget cannot be shared with other campaigns; setting this
    # False for both kinds keeps one campaign's spend from being affected by
    # edits to another.
    budget.explicitly_shared = False
    return operation


def _campaign_operation(client, customer_id: str, spec: CampaignSpec, budget_resource: str, resource_name: str):
    operation = client.get_type("MutateOperation")
    campaign = operation.campaign_operation.create
    campaign.resource_name = resource_name
    campaign.name = spec.name
    campaign.status = client.enums.CampaignStatusEnum[spec.status]
    campaign.campaign_budget = budget_resource

    if spec.start_date:
        campaign.start_date = spec.start_date.replace("-", "")
    if spec.end_date:
        campaign.end_date = spec.end_date.replace("-", "")

    if spec.is_app:
        # An App campaign is MULTI_CHANNEL with the APP_CAMPAIGN sub type. It is
        # NOT advertising_channel_type=DISPLAY or SEARCH, even though it serves
        # on both — setting either of those creates a normal campaign that
        # cannot reference an app.
        campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.MULTI_CHANNEL
        campaign.advertising_channel_sub_type = (
            client.enums.AdvertisingChannelSubTypeEnum.APP_CAMPAIGN
        )
        campaign.app_campaign_setting.app_id = spec.app_id
        campaign.app_campaign_setting.app_store = client.enums.AppCampaignAppStoreEnum[spec.app_store]
        campaign.app_campaign_setting.bidding_strategy_goal_type = (
            client.enums.AppCampaignBiddingStrategyGoalTypeEnum[spec.bidding.goal]
        )
        if spec.bidding.target_cpa is not None:
            campaign.target_cpa.target_cpa_micros = to_micros(spec.bidding.target_cpa)
    else:
        campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
        # Search partners and Display expansion both spend the budget outside
        # google.com at materially worse intent. Off while the budget is small
        # and the point is a clean read on search intent.
        campaign.network_settings.target_google_search = True
        campaign.network_settings.target_search_network = False
        campaign.network_settings.target_content_network = False
        if spec.bidding.target_cpa is not None:
            campaign.target_cpa.target_cpa_micros = to_micros(spec.bidding.target_cpa)
        else:
            campaign.maximize_conversions.CopyFrom(client.get_type("MaximizeConversions"))
        # The UTM suffix. Set at campaign level so every ad group inherits it and
        # no ad group can be created without attribution.
        campaign.final_url_suffix = spec.tracking.final_url_suffix()

    return operation


def _criteria_operations(client, customer_id: str, spec: CampaignSpec, campaign_resource: str):
    operations = []
    geo_service = client.get_service("GeoTargetConstantService")
    for location_id in spec.targeting.location_ids:
        operation = client.get_type("MutateOperation")
        criterion = operation.campaign_criterion_operation.create
        criterion.campaign = campaign_resource
        criterion.location.geo_target_constant = geo_service.geo_target_constant_path(location_id)
        operations.append(operation)

    language_service = client.get_service("GoogleAdsService")
    for language_id in spec.targeting.language_ids:
        operation = client.get_type("MutateOperation")
        criterion = operation.campaign_criterion_operation.create
        criterion.campaign = campaign_resource
        criterion.language.language_constant = language_service.language_constant_path(language_id)
        operations.append(operation)
    return operations


def _app_ad_group_operation(client, customer_id: str, spec: CampaignSpec, campaign_resource: str, resource_name: str):
    operation = client.get_type("MutateOperation")
    ad_group = operation.ad_group_operation.create
    ad_group.resource_name = resource_name
    ad_group.name = f"{spec.name} — ad group"
    ad_group.campaign = campaign_resource
    ad_group.status = client.enums.AdGroupStatusEnum.ENABLED
    return operation


def _app_ad_operation(client, customer_id: str, spec: CampaignSpec, ad_group_resource: str):
    operation = client.get_type("MutateOperation")
    ad_group_ad = operation.ad_group_ad_operation.create
    ad_group_ad.ad_group = ad_group_resource
    ad_group_ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
    for text in spec.assets.headlines:
        asset = client.get_type("AdTextAsset")
        asset.text = text
        ad_group_ad.ad.app_ad.headlines.append(asset)
    for text in spec.assets.descriptions:
        asset = client.get_type("AdTextAsset")
        asset.text = text
        ad_group_ad.ad.app_ad.descriptions.append(asset)
    return operation


def _search_ad_group_operation(client, customer_id: str, group, campaign_resource: str, resource_name: str):
    operation = client.get_type("MutateOperation")
    ad_group = operation.ad_group_operation.create
    ad_group.resource_name = resource_name
    ad_group.name = group.name
    ad_group.campaign = campaign_resource
    ad_group.status = client.enums.AdGroupStatusEnum.ENABLED
    ad_group.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    return operation


def _rsa_operation(client, customer_id: str, spec: CampaignSpec, group, ad_group_resource: str):
    operation = client.get_type("MutateOperation")
    ad_group_ad = operation.ad_group_ad_operation.create
    ad_group_ad.ad_group = ad_group_resource
    ad_group_ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
    ad_group_ad.ad.final_urls.append(group.final_url)
    for text in spec.assets.headlines:
        asset = client.get_type("AdTextAsset")
        asset.text = text
        ad_group_ad.ad.responsive_search_ad.headlines.append(asset)
    for text in spec.assets.descriptions:
        asset = client.get_type("AdTextAsset")
        asset.text = text
        ad_group_ad.ad.responsive_search_ad.descriptions.append(asset)
    return operation


def _keyword_operations(client, customer_id: str, group, ad_group_resource: str):
    operations = []
    match_type = client.enums.KeywordMatchTypeEnum[group.match_type]
    for text in group.keywords:
        operation = client.get_type("MutateOperation")
        criterion = operation.ad_group_criterion_operation.create
        criterion.ad_group = ad_group_resource
        criterion.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        criterion.keyword.text = text
        criterion.keyword.match_type = match_type
        operations.append(operation)
    for text in group.negative_keywords:
        operation = client.get_type("MutateOperation")
        criterion = operation.ad_group_criterion_operation.create
        criterion.ad_group = ad_group_resource
        criterion.negative = True
        criterion.keyword.text = text
        criterion.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD
        operations.append(operation)
    return operations


# ---------------------------------------------------------------------------
# Budget and status changes on an existing campaign.
# ---------------------------------------------------------------------------


def find_campaign(client, customer_id: str, name: str) -> dict | None:
    """Look up one campaign by exact name, with its budget and age."""
    service = client.get_service("GoogleAdsService")
    query = """
        SELECT campaign.id, campaign.name, campaign.status, campaign.start_date,
               campaign.campaign_budget, campaign_budget.amount_micros,
               campaign_budget.id, campaign.advertising_channel_sub_type
        FROM campaign
        WHERE campaign.name = @name AND campaign.status != 'REMOVED'
        LIMIT 1
    """
    request = client.get_type("SearchGoogleAdsRequest")
    request.customer_id = customer_id
    request.query = query.replace("@name", f"'{_escape(name)}'")
    for row in service.search(request=request):
        return {
            "id": row.campaign.id,
            "name": row.campaign.name,
            "status": row.campaign.status.name,
            "start_date": row.campaign.start_date,
            "budget_resource": row.campaign.campaign_budget,
            "budget_micros": row.campaign_budget.amount_micros,
            "sub_type": row.campaign.advertising_channel_sub_type.name,
        }
    return None


def _escape(value: str) -> str:
    """GAQL string literal escaping. Single quotes and backslashes only."""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def set_budget(client, customer_id: str, budget_resource: str, daily) -> str:
    operation = client.get_type("CampaignBudgetOperation")
    budget = operation.update
    budget.resource_name = budget_resource
    budget.amount_micros = to_micros(daily)
    # Without a field mask the API treats every unset field as an intentional
    # clear, which wipes the budget's name and delivery method.
    client.copy_from(
        operation.update_mask,
        client.get_type("FieldMask")(paths=["amount_micros"]),
    )
    service = client.get_service("CampaignBudgetService")
    response = service.mutate_campaign_budgets(customer_id=customer_id, operations=[operation])
    return response.results[0].resource_name


def set_status(client, customer_id: str, campaign_id: int, status: str) -> str:
    service = client.get_service("CampaignService")
    operation = client.get_type("CampaignOperation")
    campaign = operation.update
    campaign.resource_name = service.campaign_path(customer_id, campaign_id)
    campaign.status = client.enums.CampaignStatusEnum[status]
    client.copy_from(operation.update_mask, client.get_type("FieldMask")(paths=["status"]))
    response = service.mutate_campaigns(customer_id=customer_id, operations=[operation])
    return response.results[0].resource_name


def days_since(start_date: str) -> int | None:
    """Campaign age in days from a YYYY-MM-DD or YYYYMMDD start date."""
    from datetime import date, datetime

    if not start_date:
        return None
    cleaned = start_date.replace("-", "")
    try:
        started = datetime.strptime(cleaned, "%Y%m%d").date()
    except ValueError:
        return None
    return (date.today() - started).days
