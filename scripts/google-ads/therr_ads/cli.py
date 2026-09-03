"""Command line interface. `./therrads <command>` or `python -m therr_ads`.

COMMAND MAP (also in README.md, kept in sync deliberately):

  config init                        write config.yaml + settings.yaml from the examples
  auth login [--no-browser]          mint the OAuth refresh token
  auth check                         prove credentials work; list reachable accounts
  geo lookup <place>                 resolve a place name to a geo target constant id

  campaign validate <spec>           parse and validate a spec. No network.
  campaign plan <spec>               render the exact operations. No network.
  campaign apply <spec> --confirm    send them
  campaign list                      what exists in the account now
  campaign budget <name> --daily N   change spend (guarded)
  campaign pause|resume <name>       start/stop spend

  report ads [--days N]              Google Ads performance
  report ga4 [--days N]              GA4 web sessions + in-app funnel
  report product [--days N]          signups -> pacts -> invites -> payers
  report funnel [--days N]           all three, joined

  analyze [--days N] [--write-work-items]
                                     signals, verdicts and next steps

EVERY MUTATING COMMAND REQUIRES --confirm. Without it the command prints what it
would do and exits 0 having done nothing. This is a tool that spends money from
a terminal, and dry-run-by-default is the only sane default.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from decimal import Decimal
from pathlib import Path

from therr_ads import analysis, campaigns, ga4, product, reporting, workitems
from therr_ads.money import check_budget, format_micros, from_micros, to_micros
from therr_ads.settings import (
    DEFAULT_CONFIG_PATH,
    DEFAULT_SETTINGS_PATH,
    PACKAGE_ROOT,
    SettingsError,
    load_settings,
)
from therr_ads.spec import SpecError, load_spec


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "handler", None):
        parser.print_help()
        return 1
    try:
        return args.handler(args) or 0
    except (SettingsError, SpecError, FileNotFoundError) as exc:
        print(f"\nerror: {exc}\n", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="therrads",
        description="Google Ads campaign tooling for Friends with Habits.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--config", type=Path, default=None, help="path to config.yaml")
    parser.add_argument("--settings", type=Path, default=None, help="path to settings.yaml")
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    sub = parser.add_subparsers(dest="command")

    # config -----------------------------------------------------------------
    config_parser = sub.add_parser("config", help="set up the two config files")
    config_sub = config_parser.add_subparsers(dest="subcommand")
    init = config_sub.add_parser("init", help="copy the .example files into place")
    init.add_argument("--force", action="store_true", help="overwrite existing files")
    init.set_defaults(handler=_cmd_config_init)
    show = config_sub.add_parser("show", help="report which credentials are present")
    show.set_defaults(handler=_cmd_config_show)

    # auth -------------------------------------------------------------------
    auth_parser = sub.add_parser("auth", help="OAuth")
    auth_sub = auth_parser.add_subparsers(dest="subcommand")
    login = auth_sub.add_parser("login", help="mint a refresh token into config.yaml")
    login.add_argument("--no-browser", action="store_true", help="headless/SSH flow on port 8765")
    login.add_argument("--print-only", action="store_true", help="print the token, do not write it")
    login.set_defaults(handler=_cmd_auth_login)
    check = auth_sub.add_parser("check", help="verify credentials against the live API")
    check.set_defaults(handler=_cmd_auth_check)

    # geo --------------------------------------------------------------------
    geo_parser = sub.add_parser("geo", help="geo target constants")
    geo_sub = geo_parser.add_subparsers(dest="subcommand")
    lookup = geo_sub.add_parser("lookup", help="resolve a place name to an id for a spec")
    lookup.add_argument("place", nargs="+")
    lookup.set_defaults(handler=_cmd_geo_lookup)

    # campaign ---------------------------------------------------------------
    campaign_parser = sub.add_parser("campaign", help="create and manage campaigns")
    campaign_sub = campaign_parser.add_subparsers(dest="subcommand")

    validate = campaign_sub.add_parser("validate", help="parse and validate a spec (offline)")
    validate.add_argument("spec", type=Path)
    validate.set_defaults(handler=_cmd_campaign_validate)

    plan = campaign_sub.add_parser("plan", help="render the operations a spec would send (offline)")
    plan.add_argument("spec", type=Path)
    plan.set_defaults(handler=_cmd_campaign_plan)

    apply_cmd = campaign_sub.add_parser("apply", help="create the campaign")
    apply_cmd.add_argument("spec", type=Path)
    apply_cmd.add_argument("--confirm", action="store_true", help="required to actually send")
    apply_cmd.set_defaults(handler=_cmd_campaign_apply)

    listing = campaign_sub.add_parser("list", help="campaigns currently in the account")
    listing.set_defaults(handler=_cmd_campaign_list)

    budget = campaign_sub.add_parser("budget", help="change a campaign's daily budget")
    budget.add_argument("name")
    budget.add_argument("--daily", required=True, help="new daily budget in account currency")
    budget.add_argument("--confirm", action="store_true")
    budget.add_argument("--force", action="store_true", help="proceed despite warnings")
    budget.set_defaults(handler=_cmd_campaign_budget)

    for verb, status in (("pause", "PAUSED"), ("resume", "ENABLED")):
        status_parser = campaign_sub.add_parser(verb, help=f"set a campaign to {status}")
        status_parser.add_argument("name")
        status_parser.add_argument("--confirm", action="store_true")
        status_parser.set_defaults(handler=_cmd_campaign_status, status=status)

    # report -----------------------------------------------------------------
    report_parser = sub.add_parser("report", help="pull performance data")
    report_sub = report_parser.add_subparsers(dest="subcommand")
    for name, handler in (
        ("ads", _cmd_report_ads),
        ("ga4", _cmd_report_ga4),
        ("product", _cmd_report_product),
        ("funnel", _cmd_report_funnel),
    ):
        report_cmd = report_sub.add_parser(name, help=f"{name} report")
        report_cmd.add_argument("--days", type=int, default=14)
        report_cmd.set_defaults(handler=handler)

    # analyze ----------------------------------------------------------------
    analyze = sub.add_parser("analyze", help="signals, verdicts and action items")
    analyze.add_argument("--days", type=int, default=14)
    analyze.add_argument(
        "--write-work-items",
        action="store_true",
        help="file the action items into docs/WORK_IN_PROGRESS.md and the playbook",
    )
    analyze.set_defaults(handler=_cmd_analyze)

    return parser


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _settings(args):
    return load_settings(args.settings)


def _client(args):
    from therr_ads.client import build_client

    return build_client(args.config)


def _emit(args, payload: dict, text: str) -> None:
    if getattr(args, "json", False):
        print(json.dumps(payload, indent=2, default=str))
    else:
        print(text)


def _guard(condition: bool, message: str) -> bool:
    if not condition:
        print(f"\nDRY RUN — nothing was sent.\n{message}\n")
    return condition


def _run_ads_client(args):
    """Build a client and translate GoogleAdsException into a readable error."""
    from therr_ads.client import explain

    try:
        return _client(args), explain
    except Exception:
        raise


def _call(fn, *fn_args, **kwargs):
    from therr_ads.client import explain

    try:
        return fn(*fn_args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        if type(exc).__name__ == "GoogleAdsException":
            print(f"\nGoogle Ads API error:\n{explain(exc)}\n", file=sys.stderr)
            raise SystemExit(2) from exc
        raise


# ---------------------------------------------------------------------------
# config / auth
# ---------------------------------------------------------------------------


def _cmd_config_init(args) -> int:
    created = []
    for example, target in (
        (PACKAGE_ROOT / "config.example.yaml", args.config or DEFAULT_CONFIG_PATH),
        (PACKAGE_ROOT / "settings.example.yaml", args.settings or DEFAULT_SETTINGS_PATH),
    ):
        if target.exists() and not args.force:
            print(f"  exists, kept: {target}  (use --force to overwrite)")
            continue
        shutil.copyfile(example, target)
        created.append(target)
        print(f"  wrote: {target}")

    if created:
        print(
            "\nNext:\n"
            "  1. Fill in developer_token, client_id, client_secret and login_customer_id in\n"
            f"     {args.config or DEFAULT_CONFIG_PATH}\n"
            "     (each one's source is documented inline in that file)\n"
            "  2. ./therrads auth login\n"
            "  3. ./therrads auth check\n"
        )
    return 0


def _cmd_config_show(args) -> int:
    from therr_ads.auth import describe_config

    path = args.config or DEFAULT_CONFIG_PATH
    print(f"\n{path}")
    # `config show` is the command you reach for when nothing works, so a
    # missing file has to be reported as a state, not raised as an error.
    if path.exists():
        for line in describe_config(path):
            print(line)
    else:
        print("  [MISSING] run `./therrads config init`")

    settings_path = args.settings or DEFAULT_SETTINGS_PATH
    print(f"\n{settings_path}")
    if settings_path.exists():
        settings = load_settings(settings_path)
        print(f"  customer_id       = {settings.customer_id}")
        print(f"  ga4.property_id   = {settings.ga4.property_id or '(unset)'}  (web)")
        print(f"  ga4.app_property_id = {settings.ga4.app_property_id or '(unset)'}  (app)")
        print(f"  ga4.web_hostname  = {settings.ga4.web_hostname or '(unset — reports every site)'}")
        print(f"  product_db.enabled= {settings.product_db.enabled}")
        print(f"  max_daily_budget  = {settings.limits.max_daily_budget}")
    else:
        print("  [MISSING] run `./therrads config init`")
    print()
    return 0


def _cmd_auth_login(args) -> int:
    from therr_ads.auth import run_login

    run_login(args.config, no_browser=args.no_browser, write=not args.print_only)
    return 0


def _cmd_auth_check(args) -> int:
    from therr_ads.auth import describe_config
    from therr_ads.client import list_accessible_customers

    path = args.config or DEFAULT_CONFIG_PATH
    print(f"\nCredentials in {path}:")
    for line in describe_config(path):
        print(line)

    client = _client(args)
    customers = _call(list_accessible_customers, client)
    print(f"\nAccounts this refresh token can reach ({len(customers)}):")
    for customer_id in customers:
        print(f"  {customer_id}")

    try:
        settings = _settings(args)
        configured = settings.require_customer_id()
        if configured in customers:
            print(f"\nsettings.yaml -> customer_id {configured} is reachable. Setup is complete.")
        else:
            print(
                f"\nWARNING: settings.yaml -> customer_id is {configured}, which is not in the list "
                "above. Either it is not under the configured login_customer_id, or you authorised "
                "the wrong Google account. Operations against it will fail with USER_PERMISSION_DENIED."
            )
    except SettingsError as exc:
        print(f"\nnote: {exc}")
    print()
    return 0


def _cmd_geo_lookup(args) -> int:
    client = _client(args)
    service = client.get_service("GeoTargetConstantService")
    request = client.get_type("SuggestGeoTargetConstantsRequest")
    request.locale = "en"
    request.country_code = "US"
    request.location_names.names.extend([" ".join(args.place)])
    response = _call(service.suggest_geo_target_constants, request=request)

    print()
    for suggestion in response.geo_target_constant_suggestions:
        constant = suggestion.geo_target_constant
        print(
            f"  {constant.id:<10} {constant.canonical_name}"
            f"  ({constant.target_type}, reach {suggestion.reach})"
        )
    print("\nPut the id into a spec's targeting.location_ids.\n")
    return 0


# ---------------------------------------------------------------------------
# campaign
# ---------------------------------------------------------------------------


def _cmd_campaign_validate(args) -> int:
    spec = load_spec(args.spec)
    print(f"\nVALID  {spec.source_path}")
    print(f"  {spec.name}  ({spec.kind}, {spec.budget.daily} {spec.budget.currency}/day)")
    for warning in spec.warnings:
        print(f"  ! {warning}")
    print()
    return 0


def _cmd_campaign_plan(args) -> int:
    spec = load_spec(args.spec)
    settings = _settings(args)
    plan = campaigns.build_plan(spec, settings)
    print(plan.render())
    return 0 if plan.can_apply else 1


def _cmd_campaign_apply(args) -> int:
    spec = load_spec(args.spec)
    settings = _settings(args)

    # Creating a campaign is what ADDS burn to the account, so the account-wide
    # ceiling has to be evaluated against what is already running — not against
    # zero. `campaign plan` stays offline and therefore reports only the
    # per-campaign ceiling; this is the path that spends money, so it pays for
    # the extra query. Without it, limits.max_total_daily_budget is unenforced
    # on creation and N campaigns each under the per-campaign cap silently
    # multiply the intended burn.
    client = _client(args)
    customer_id = settings.require_customer_id()
    others = _sum_other_budgets(client, customer_id)

    plan = campaigns.build_plan(spec, settings, other_campaigns_micros=others)
    print(plan.render())

    if not plan.can_apply:
        print("Refusing to apply — resolve the blockers above.\n", file=sys.stderr)
        return 2
    if not _guard(args.confirm, "Re-run with --confirm to create these entities."):
        return 0

    result = _call(campaigns.apply_plan, client, customer_id, spec)
    print(f"\nCreated {len(result['created'])} resources.")
    print(f"Campaign: {result['campaign_resource_name']}")
    print(
        f"\nIt is {spec.status}. "
        + (
            f"Start spending with:\n  ./therrads campaign resume \"{spec.name}\" --confirm\n"
            if spec.status == "PAUSED"
            else "It is ENABLED and will begin spending.\n"
        )
    )
    return 0


def _cmd_campaign_list(args) -> int:
    settings = _settings(args)
    client = _client(args)
    customer_id = settings.require_customer_id()
    service = client.get_service("GoogleAdsService")
    request = client.get_type("SearchGoogleAdsRequest")
    request.customer_id = customer_id
    request.query = """
        SELECT campaign.id, campaign.name, campaign.status, campaign.start_date,
               campaign.advertising_channel_sub_type, campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
    """
    rows = []
    print()
    for row in _call(service.search, request=request):
        age = campaigns.days_since(row.campaign.start_date)
        rows.append(
            {
                "id": row.campaign.id,
                "name": row.campaign.name,
                "status": row.campaign.status.name,
                "daily_budget": float(from_micros(row.campaign_budget.amount_micros)),
                "age_days": age,
            }
        )
        print(
            f"  {row.campaign.status.name:<8} {row.campaign.name:<34} "
            f"{format_micros(row.campaign_budget.amount_micros)}/day"
            + (f"  age {age}d" if age is not None else "")
        )
    if not rows:
        print("  (no campaigns)")
    print()
    if args.json:
        print(json.dumps(rows, indent=2))
    return 0


def _cmd_campaign_budget(args) -> int:
    settings = _settings(args)
    client = _client(args)
    customer_id = settings.require_customer_id()

    campaign = _call(campaigns.find_campaign, client, customer_id, args.name)
    if campaign is None:
        print(f"\nNo campaign named {args.name!r}. `./therrads campaign list` shows what exists.\n",
              file=sys.stderr)
        return 2

    others = _sum_other_budgets(client, customer_id, campaign["id"])
    decision = check_budget(
        args.daily,
        settings.limits,
        current_micros=campaign["budget_micros"],
        other_campaigns_micros=others,
        days_since_start=campaigns.days_since(campaign["start_date"]),
    )

    print(f"\n{campaign['name']}")
    print(f"  current: {format_micros(campaign['budget_micros'])}/day")
    print(f"  proposed:{format_micros(decision.proposed_micros)}/day")
    if others:
        print(f"  other managed campaigns: {format_micros(others)}/day")

    for message in decision.blocked:
        print(f"  x {message}")
    for message in decision.warnings:
        print(f"  ! {message}")

    if not decision.allowed:
        print("\nRefusing — raise the limit in settings.yaml if this is intended.\n", file=sys.stderr)
        return 2
    if decision.needs_force and not args.force:
        print("\nWarnings above. Re-run with --force (and --confirm) to proceed anyway.\n")
        return 1
    if not _guard(args.confirm, "Re-run with --confirm to apply the new budget."):
        return 0

    _call(campaigns.set_budget, client, customer_id, campaign["budget_resource"], args.daily)
    print(f"\nBudget set to {format_micros(decision.proposed_micros)}/day.\n")
    return 0


def _sum_other_budgets(client, customer_id: str, exclude_campaign_id: int | None = None) -> int:
    service = client.get_service("GoogleAdsService")
    request = client.get_type("SearchGoogleAdsRequest")
    request.customer_id = customer_id
    request.query = """
        SELECT campaign.id, campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.status = 'ENABLED'
    """
    total = 0
    for row in service.search(request=request):
        if row.campaign.id != exclude_campaign_id:
            total += row.campaign_budget.amount_micros
    return total


def _cmd_campaign_status(args) -> int:
    settings = _settings(args)
    client = _client(args)
    customer_id = settings.require_customer_id()

    campaign = _call(campaigns.find_campaign, client, customer_id, args.name)
    if campaign is None:
        print(f"\nNo campaign named {args.name!r}.\n", file=sys.stderr)
        return 2

    print(f"\n{campaign['name']}: {campaign['status']} -> {args.status}")
    if args.status == "ENABLED":
        print(
            f"  This starts spending up to {format_micros(campaign['budget_micros'])}/day.\n"
            "  Google may spend up to 2x on a high-traffic day, balanced over the month."
        )
        # Resuming is the other operation that adds burn to the account, and it
        # adds the campaign's FULL daily budget at once. _sum_other_budgets only
        # counts ENABLED campaigns, so a paused campaign is invisible to the
        # ceiling until exactly this moment — checking here is what stops a
        # resume walking the account past limits.max_total_daily_budget.
        #
        # Deliberately no days_since_start: a campaign created by `campaign
        # apply` is PAUSED and zero days old, so a learning-period warning would
        # fire on every first resume and gate the documented launch flow behind
        # --force. Only hard blockers stop a resume.
        others = _sum_other_budgets(client, customer_id, campaign["id"])
        decision = check_budget(
            from_micros(campaign["budget_micros"]),
            settings.limits,
            other_campaigns_micros=others,
        )
        if others:
            print(f"  other enabled campaigns: {format_micros(others)}/day")
        for message in decision.blocked:
            print(f"  x {message}")
        if not decision.allowed:
            print(
                "\nRefusing to resume — this would put the account over its ceiling. Lower this "
                "campaign's budget, pause another, or raise the limit in settings.yaml.\n",
                file=sys.stderr,
            )
            return 2

    if not _guard(args.confirm, f"Re-run with --confirm to set it {args.status}."):
        return 0

    _call(campaigns.set_status, client, customer_id, campaign["id"], args.status)
    print(f"\n{campaign['name']} is now {args.status}.\n")
    return 0


# ---------------------------------------------------------------------------
# report
# ---------------------------------------------------------------------------


def _cmd_report_ads(args) -> int:
    settings = _settings(args)
    client = _client(args)
    report = _call(reporting.fetch, client, settings.require_customer_id(), days=args.days)
    _emit(args, report.to_dict(), _format_ads(report))
    return 0


def _format_ads(report) -> str:
    lines = ["", f"GOOGLE ADS — {report.start_date} to {report.end_date}", ""]
    if not report.campaigns:
        lines.append("  (no delivery)")
    for campaign in sorted(report.campaigns, key=lambda c: -c.cost):
        lines.append(f"  {campaign.campaign_name}  [{campaign.status}, {campaign.sub_type}]")
        lines.append(
            f"    {campaign.impressions:,} impr  {campaign.clicks:,} clicks  CTR {campaign.ctr:.2%}  "
            f"CPC {campaign.cpc}  spend {campaign.cost}"
        )
        lines.append(
            f"    {campaign.conversions:g} conversions ({campaign.installs:g} installs)  "
            f"cost/conv {campaign.cost_per_conversion}"
        )
    if report.ad_groups:
        lines += ["", "  BY AD GROUP (the keyword-theme experiment):"]
        for group in sorted(report.ad_groups, key=lambda g: -g.cost)[:15]:
            lines.append(
                f"    {group.ad_group_name:<28} {group.clicks:>5} clicks  {group.cost:>8} spend  "
                f"{group.conversions:g} conv  cost/conv {group.cost_per_conversion}"
            )
    if report.search_terms:
        lines += ["", "  TOP SEARCH TERMS (what people actually typed):"]
        for term in report.search_terms[:15]:
            lines.append(
                f"    {term.search_term:<40} {term.clicks:>4} clicks  {term.cost:>8}  "
                f"{term.conversions:g} conv"
            )
    for note in report.notes:
        lines += ["", f"  note: {note}"]
    return "\n".join(lines) + "\n"


def _cmd_report_ga4(args) -> int:
    settings = _settings(args)
    report = ga4.fetch(
        settings.ga4.property_id,
        days=args.days,
        crawler_guard=settings.ga4.crawler_guard,
        include_surface=settings.ga4.surface_dimension_registered,
        host_name=settings.ga4.web_hostname,
    )
    app = ga4.fetch_app_funnel(
        settings.ga4.app_property_id,
        days=args.days,
        stream_name=settings.ga4.app_stream_name,
    )
    payload = {**report.to_dict(), "app_funnel": app.to_dict()}
    _emit(args, payload, _format_ga4(report) + _format_app_funnel(app))
    return 0


def _format_app_funnel(report) -> str:
    lines = [
        "",
        f"IN-APP FUNNEL (property {report.property_id or '(unset)'}, stream "
        f"'{report.stream_name}') — {report.start_date} to {report.end_date}",
        "",
    ]
    installs = report.installs
    for step in report.steps:
        if not step.instrumented:
            # Never render a not-yet-emitted event as 0 — a column of zeroes
            # reads as a product failure rather than a missing logEvent call.
            lines.append(f"    {step.label:<30} {'not instrumented':>12}   ({step.event_name})")
            continue
        share = f"{step.users / installs:.1%}" if installs else "—"
        lines.append(f"    {step.label:<30} {step.users:>7} users  {share:>7} of installs")
    for note in report.notes:
        lines += ["", f"  note: {note}"]
    return "\n".join(lines) + "\n"


def _format_ga4(report) -> str:
    lines = ["", f"GA4 (property {report.property_id}) — {report.start_date} to {report.end_date}", ""]
    if report.by_campaign:
        lines.append("  BY CAMPAIGN / SOURCE / MEDIUM:")
        for row in sorted(report.by_campaign, key=lambda r: -r.sessions)[:15]:
            label = " / ".join(str(v) for v in row.dimensions.values())
            lines.append(
                f"    {label:<50} {row.sessions:>6} sess  {row.new_users:>5} new  "
                f"eng {row.engagement_rate:.0%}  {row.conversions:g} conv"
            )
    for warning in report.warnings:
        lines += ["", f"  WARNING: {warning}"]
    for note in report.notes:
        lines += ["", f"  note: {note}"]
    return "\n".join(lines) + "\n"


def _cmd_report_product(args) -> int:
    settings = _settings(args)
    report = product.fetch(settings.product_db, days=args.days)
    _emit(args, report.to_dict(), _format_product(report))
    return 0


def _format_product(report) -> str:
    lines = ["", f"PRODUCT FUNNEL — {report.start_date} to {report.end_date}", ""]
    if report.rows:
        lines.append(
            f"    {'campaign':<34} {'signups':>7} {'pact':>6} {'unlock':>7} {'checkin':>8} "
            f"{'payers':>7} {'revenue':>9}"
        )
    for row in report.rows:
        lines.append(
            f"    {row.campaign:<34} {row.signups:>7} {row.activated:>6} {row.unlocked:>7} "
            f"{row.checked_in:>8} {row.payers:>7} {row.revenue:>9}"
        )
        if row.signups:
            lines.append(
                f"    {'':<34} {'':>7} {row.activation_rate:>5.0%} {row.unlock_rate:>6.0%} "
                f"{row.retention_proxy:>7.0%} {row.payer_rate:>6.1%}"
            )
    for note in report.notes:
        lines += ["", f"  note: {note}"]
    return "\n".join(lines) + "\n"


def _cmd_report_funnel(args) -> int:
    settings = _settings(args)
    client = _client(args)
    ads_report = _call(reporting.fetch, client, settings.require_customer_id(), days=args.days)
    ga4_report = ga4.fetch(
        settings.ga4.property_id,
        days=args.days,
        crawler_guard=settings.ga4.crawler_guard,
        include_surface=settings.ga4.surface_dimension_registered,
        host_name=settings.ga4.web_hostname,
    )
    app_funnel = ga4.fetch_app_funnel(
        settings.ga4.app_property_id, days=args.days, stream_name=settings.ga4.app_stream_name
    )
    product_report = product.fetch(settings.product_db, days=args.days)

    payload = {
        "ads": ads_report.to_dict(),
        "ga4": ga4_report.to_dict(),
        "app_funnel": app_funnel.to_dict(),
        "product": product_report.to_dict(),
    }
    text = (
        _format_ads(ads_report)
        + _format_ga4(ga4_report)
        + _format_app_funnel(app_funnel)
        + _format_product(product_report)
    )
    _emit(args, payload, text)
    return 0


# ---------------------------------------------------------------------------
# analyze
# ---------------------------------------------------------------------------


def _cmd_analyze(args) -> int:
    settings = _settings(args)
    client = _client(args)
    ads_report = _call(reporting.fetch, client, settings.require_customer_id(), days=args.days)
    ga4_report = ga4.fetch(
        settings.ga4.property_id,
        days=args.days,
        crawler_guard=settings.ga4.crawler_guard,
        include_surface=settings.ga4.surface_dimension_registered,
        host_name=settings.ga4.web_hostname,
    )
    app_funnel = ga4.fetch_app_funnel(
        settings.ga4.app_property_id, days=args.days, stream_name=settings.ga4.app_stream_name
    )
    product_report = product.fetch(settings.product_db, days=args.days)

    diagnosis = analysis.analyze(
        ads_report, ga4_report, product_report, settings.targets, app_funnel=app_funnel
    )
    _emit(args, diagnosis.to_dict(), format_diagnosis(diagnosis))

    if args.write_work_items:
        results = workitems.write_actions(
            diagnosis.sorted_actions(),
            diagnosis,
            settings.resolved_output("work_in_progress"),
            settings.resolved_output("playbook"),
        )
        print("\nWrote work items:")
        for line in results:
            print(f"  {line}")
        print(
            "\nReview the diff before committing — these are generated claims about the business, "
            "and they are only as good as the window they were computed over.\n"
        )
    return 0


def format_diagnosis(diagnosis) -> str:
    """Render a Diagnosis for a terminal. Also used by the tests."""
    icons = {"critical": "XX", "warning": " !", "info": " ·", "good": " +"}
    lines = ["", f"DIAGNOSIS — {diagnosis.window}", ""]

    lines.append("SIGNALS")
    for signal in diagnosis.sorted_signals():
        lines.append(f"  {icons.get(signal.severity, '  ')} [{signal.area}] {signal.statement}")
        if signal.evidence:
            lines.append(f"        {signal.evidence}")
    if not diagnosis.signals:
        lines.append("  (none)")

    lines += ["", "VERDICTS"]
    for verdict in diagnosis.verdicts:
        lines.append(f"  {verdict.area}: {verdict.call}")
        for chunk in _wrap(verdict.reasoning, 92):
            lines.append(f"      {chunk}")
    if not diagnosis.verdicts:
        lines.append("  (none)")

    lines += ["", "ACTION ITEMS"]
    for action in diagnosis.sorted_actions():
        lines.append(f"  P{action.priority} [{action.kind}] {action.title}")
        for chunk in _wrap(action.rationale, 92):
            lines.append(f"      {chunk}")
    if not diagnosis.actions:
        lines.append("  (none)")

    lines += [
        "",
        "File these into the backlog:  ./therrads analyze --write-work-items",
        "",
    ]
    return "\n".join(lines)


def _wrap(text: str, width: int) -> list[str]:
    import textwrap

    return textwrap.wrap(" ".join(str(text).split()), width=width)
