"""Command line front end, for debugging the tools outside an MCP session.

Everything the MCP server exposes is reachable here. When a tool misbehaves,
running the same call as `./therrplay ...` gives you a stack trace instead of a
JSON error string, which is usually the faster way to find out what broke.

    ./therrplay check                     # auth + bucket + app config
    ./therrplay ls stats/installs/        # what does the bucket actually hold
    ./therrplay installs --app habits --days 30
    ./therrplay acquisition --app habits --dimension traffic_source
    ./therrplay retention --app habits
    ./therrplay releases --app habits
    ./therrplay vitals --app habits --metric-set crashrate
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta

from therr_play import gcs_reports, publisher, reporting_api
from therr_play.auth import describe_failure, get_credentials
from therr_play.settings import SettingsError, load_settings


def _window(args) -> tuple[date, date]:
    end = date.fromisoformat(args.end) if args.end else date.today() - timedelta(days=3)
    start = date.fromisoformat(args.start) if args.start else end - timedelta(days=args.days - 1)
    return start, end


def _emit(payload) -> None:
    print(json.dumps(payload, indent=2, default=str))


def _report(args, kind: str, default_dimension: str) -> None:
    settings = load_settings()
    app = settings.app(args.app)
    creds = get_credentials(settings)
    client = gcs_reports.storage_client(creds)
    start, end = _window(args)
    result = gcs_reports.fetch_report(
        client, settings.require_bucket(), kind, app.package,
        start, end, args.dimension or default_dimension, settings.max_rows,
    )
    _emit(
        {
            "kind": result.kind,
            "package": result.package,
            "dimension": result.dimension,
            "window": [start.isoformat(), end.isoformat()],
            "row_count": len(result.rows),
            "columns": result.columns,
            "objects_read": result.objects_found,
            "objects_not_found": result.objects_missing,
            "partial_months": result.partial_months,
            "empty_reason": result.empty_reason(),
            "rows": result.rows[: args.limit],
        }
    )


def cmd_check(args) -> int:
    settings = load_settings()
    print(f"bucket:      {settings.bucket or '(not set)'}")
    print(f"default app: {settings.default_app or '(not set)'}")
    for app in settings.apps.values():
        print(f"  app {app.key:<10} -> {app.package}")
    print(f"credentials: {settings.credentials_path or 'application default (gcloud)'}")

    creds = get_credentials(settings)
    print("credentials resolved OK")

    ok = True
    try:
        client = gcs_reports.storage_client(creds)
        names = gcs_reports.list_report_files(client, settings.require_bucket(), "stats/", 5)
        print(f"bucket read OK — {len(names)} object(s) sampled under stats/")
        for name in names:
            print(f"  {name}")
    except Exception as exc:  # noqa: BLE001
        ok = False
        print(f"bucket read FAILED: {describe_failure(exc)}")

    try:
        apps = reporting_api.search_apps(reporting_api.reporting_client(creds))
        print(f"reporting API OK — {len(apps)} app(s) visible")
        for app in apps:
            print(f"  {app.get('packageName')}  {app.get('displayName')}")
    except Exception as exc:  # noqa: BLE001
        ok = False
        print(f"reporting API FAILED: {describe_failure(exc)}")

    return 0 if ok else 1


def cmd_ls(args) -> int:
    settings = load_settings()
    client = gcs_reports.storage_client(get_credentials(settings))
    for name in gcs_reports.list_report_files(
        client, settings.require_bucket(), args.prefix, args.limit
    ):
        print(name)
    return 0


def cmd_installs(args) -> int:
    _report(args, "installs", "overview")
    return 0


def cmd_acquisition(args) -> int:
    _report(args, "store_performance", "traffic_source")
    return 0


def cmd_retention(args) -> int:
    from therr_play.gcs_reports import UNAVAILABLE_KINDS

    _emit({"available": False, "reason": UNAVAILABLE_KINDS["retained_installers"]})
    return 0


def cmd_ratings(args) -> int:
    _report(args, "ratings", "overview")
    return 0


def cmd_crashes(args) -> int:
    _report(args, "crashes", "overview")
    return 0


def cmd_releases(args) -> int:
    settings = load_settings()
    app = settings.app(args.app)
    service = publisher.publisher_client(get_credentials(settings))
    _emit({"package": app.package, "tracks": publisher.list_tracks(service, app.package)})
    return 0


def cmd_vitals(args) -> int:
    settings = load_settings()
    app = settings.app(args.app)
    service = reporting_api.reporting_client(get_credentials(settings))
    start, end = _window(args)
    _emit(reporting_api.query_vitals(service, args.metric_set, app.package, start, end))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="therrplay", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    def add_common(p, dimension=True):
        p.add_argument("--app", default=None, help="app key from settings.yaml, or a package name")
        p.add_argument("--start", default=None, help="ISO date")
        p.add_argument("--end", default=None, help="ISO date (default: 3 days ago — Play lags)")
        p.add_argument("--days", type=int, default=30)
        p.add_argument("--limit", type=int, default=200)
        if dimension:
            p.add_argument("--dimension", default=None)

    sub.add_parser("check", help="verify auth, bucket access and app config").set_defaults(
        func=cmd_check
    )

    p_ls = sub.add_parser("ls", help="list objects in the reports bucket")
    p_ls.add_argument("prefix", nargs="?", default="")
    p_ls.add_argument("--limit", type=int, default=200)
    p_ls.set_defaults(func=cmd_ls)

    for name, fn in (
        ("installs", cmd_installs),
        ("acquisition", cmd_acquisition),
        ("retention", cmd_retention),
        ("ratings", cmd_ratings),
        ("crashes", cmd_crashes),
    ):
        p = sub.add_parser(name)
        add_common(p)
        p.set_defaults(func=fn)

    p_rel = sub.add_parser("releases", help="track state: versionCodes and rollout")
    p_rel.add_argument("--app", default=None)
    p_rel.set_defaults(func=cmd_releases)

    p_vit = sub.add_parser("vitals", help="crash rate, ANR rate and friends")
    add_common(p_vit, dimension=False)
    p_vit.add_argument("--metric-set", default="crashrate")
    p_vit.set_defaults(func=cmd_vitals)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except SettingsError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001
        print(f"error: {describe_failure(exc)}", file=sys.stderr)
        return 1
