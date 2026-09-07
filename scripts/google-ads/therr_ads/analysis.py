"""Turn Ads + GA4 + product rows into signals, verdicts and action items.

PURE. No network, no credentials, no I/O. Everything here takes report objects
and returns a Diagnosis, which is why it is the only module with real unit test
coverage — it is also the only module whose output a human will act on.

THE STANCE THIS MODULE TAKES
A metric is not a finding. "CPI is $4.10" is a number; "the channel is
unaffordable at the current price point, and the next move is X" is a finding.
Every rule below therefore does three things: states what is true, names which
of the three business questions it bears on, and proposes a specific next
action. Rules that cannot do all three are not rules, they are dashboards.

THE THREE QUESTIONS, which map to the three Verdict areas:
  CHANNEL   Can we buy users at a price we can pay? (Ads metrics)
  PRODUCT   Do bought users do the thing the app is for? (funnel activation)
  MODEL     Does the money work at this price and this LTV? (payers, revenue)

REFUSING TO ANSWER IS AN ANSWER
Below targets.min_conversions_for_verdict, every verdict is INSUFFICIENT_DATA
and no pivot is recommended. A 3-conversion sample that appears to show a 66%
activation rate has produced a decision-shaped object with no information in it,
and acting on it is worse than waiting.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from decimal import Decimal

from therr_ads.ga4 import ACTIVATION_EVENT, ACTIVATION_PROXY_EVENT

# Google Play's service fee is 15% on the first $1M of annual revenue, so the
# $20 Founder Unlock nets ~$17. Paid acquisition has to clear the NET, not the
# sticker price — and for a one-time purchase there is no second payment to
# amortise a higher CAC against.
FOUNDER_UNLOCK_PRICE = Decimal("20.00")
PLAY_STORE_FEE_RATE = Decimal("0.15")
FOUNDER_UNLOCK_NET = (FOUNDER_UNLOCK_PRICE * (1 - PLAY_STORE_FEE_RATE)).quantize(Decimal("0.01"))

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2, "good": 3}


@dataclass
class Signal:
    """One observed fact, with its evidence attached."""

    severity: str        # critical | warning | info | good
    area: str            # CHANNEL | PRODUCT | MODEL | DATA | OPS
    statement: str
    evidence: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Verdict:
    area: str
    call: str            # VIABLE | UNVIABLE | AT_RISK | INSUFFICIENT_DATA
    reasoning: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ActionItem:
    """A next step concrete enough for a coding agent to start on.

    `target` decides where `--write-work-items` files it:
      wip      -> docs/WORK_IN_PROGRESS.md (code work and manual ops steps)
      playbook -> docs/PAID_ACQUISITION_PLAYBOOK.md (campaign/business decisions)
    """

    priority: int        # 1 highest
    title: str
    rationale: str
    target: str = "wip"
    kind: str = "code"   # code | campaign | manual | decision

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Diagnosis:
    window: str
    signals: list[Signal] = field(default_factory=list)
    verdicts: list[Verdict] = field(default_factory=list)
    actions: list[ActionItem] = field(default_factory=list)

    def sorted_signals(self) -> list[Signal]:
        return sorted(self.signals, key=lambda s: SEVERITY_ORDER.get(s.severity, 9))

    def sorted_actions(self) -> list[ActionItem]:
        return sorted(self.actions, key=lambda a: a.priority)

    def to_dict(self) -> dict:
        return {
            "window": self.window,
            "signals": [s.to_dict() for s in self.sorted_signals()],
            "verdicts": [v.to_dict() for v in self.verdicts],
            "actions": [a.to_dict() for a in self.sorted_actions()],
        }


def _ratio(numerator, denominator) -> Decimal:
    """A rate, to four places. For percentages and conversion rates."""
    if not denominator:
        return Decimal("0")
    return (Decimal(numerator) / Decimal(denominator)).quantize(Decimal("0.0001"))


def _per_unit(total, count) -> Decimal:
    """A cost-per-something, to the cent.

    Separate from _ratio because a cost printed to four decimal places reads as
    a rate, and "cost per install is 8.0000" is a sentence nobody parses as $8.
    """
    if not count:
        return Decimal("0")
    return (Decimal(total) / Decimal(count)).quantize(Decimal("0.01"))


def _has_verdict(diagnosis: Diagnosis, area: str) -> bool:
    return any(v.area == area for v in diagnosis.verdicts)


def _money(value) -> str:
    """Money for display. No currency symbol — the account currency is whatever
    settings.yaml says, and inventing a $ here would be wrong for a EUR account."""
    return f"{Decimal(value).quantize(Decimal('0.01'))}"


def analyze(ads_report, ga4_report, funnel_report, targets, app_funnel=None) -> Diagnosis:
    """Run every rule. `ga4_report`, `funnel_report` and `app_funnel` may be None.

    `app_funnel` is the GA4 in-app funnel (ga4.AppFunnelReport). It runs before
    the product-database rule because for the app_install arm it is the ONLY
    evidence about what bought users do — the product DB cannot see them, since
    a Play install sets no UTM.
    """
    window = f"{ads_report.start_date} to {ads_report.end_date}"
    diagnosis = Diagnosis(window=window)

    _rule_no_delivery(diagnosis, ads_report)
    _rule_channel_cost(diagnosis, ads_report, targets)
    _rule_ad_group_comparison(diagnosis, ads_report, targets)
    _rule_search_terms(diagnosis, ads_report)
    _rule_data_integrity(diagnosis, ga4_report, funnel_report)
    _rule_app_activation(diagnosis, app_funnel, targets)
    _rule_product_funnel(diagnosis, ads_report, funnel_report, targets)
    _rule_unit_economics(diagnosis, ads_report, funnel_report, targets)

    # Last, because it reads the verdicts the rules above produced.
    _reconcile_scale_recommendations(diagnosis)

    return diagnosis


def _reconcile_scale_recommendations(diagnosis: Diagnosis) -> None:
    """Stop the report recommending two opposite things at once.

    The CHANNEL rules judge price and the PRODUCT rules judge what the purchase
    is worth, so a cheap install sitting on top of a funnel nobody survives
    produces "step budget up by 20%" and "hold budget" in the same output. Both
    are correct in isolation and the pair is useless — a reader acts on whichever
    they read first.

    Cost is the weaker claim, so it yields: the scale-up is kept (the CPI finding
    behind it is still true and still worth knowing) but marked and demoted below
    the thing blocking it.
    """
    product = next((v for v in diagnosis.verdicts if v.area == "PRODUCT"), None)
    if product is None or product.call != "UNVIABLE":
        return

    for action in diagnosis.actions:
        if action.kind != "campaign" or "budget up" not in action.title.lower():
            continue
        action.title = f"[BLOCKED by PRODUCT] {action.title}"
        action.priority = max(action.priority + 1, 3)
        action.rationale = (
            "Do not act on this yet. The PRODUCT verdict is UNVIABLE, so the installs this "
            "would buy more of stop at the same wall — scaling multiplies the leak rather "
            "than the outcome. The underlying cost finding is still true and is kept here "
            "because it is what makes the funnel fix worth doing: "
        ) + action.rationale


# ---------------------------------------------------------------------------
# CHANNEL
# ---------------------------------------------------------------------------


def _rule_no_delivery(diagnosis: Diagnosis, ads) -> None:
    if ads.campaigns:
        return
    diagnosis.signals.append(
        Signal(
            "info",
            "OPS",
            "No campaign served an impression in this window.",
            "Either every campaign is still PAUSED, or none has been created yet.",
        )
    )
    diagnosis.verdicts.append(
        Verdict("CHANNEL", "INSUFFICIENT_DATA", "Nothing has been bought yet, so nothing can be judged.")
    )
    diagnosis.actions.append(
        ActionItem(
            1,
            "Enable the first Friends with Habits campaign and let it run 7 days untouched",
            "Specs exist and validate. A campaign is created PAUSED by design; until it is resumed "
            "there is no data. Resume with `./therrads campaign resume <name> --confirm`, then change "
            "nothing for a full learning period — early edits reset it and produce a longer, more "
            "expensive route to the same answer.",
            target="playbook",
            kind="campaign",
        )
    )


def _rule_channel_cost(diagnosis: Diagnosis, ads, targets) -> None:
    for campaign in ads.campaigns:
        is_app = campaign.sub_type == "APP_CAMPAIGN"
        conversions = campaign.installs if is_app else campaign.conversions
        label = "install" if is_app else "signup"
        ceiling = targets.max_cpi if is_app else targets.max_cost_per_signup

        if conversions < targets.min_conversions_for_verdict:
            diagnosis.signals.append(
                Signal(
                    "info",
                    "CHANNEL",
                    f"{campaign.campaign_name}: {conversions:.0f} {label}s — below the "
                    f"{targets.min_conversions_for_verdict} needed for a verdict.",
                    f"Spent {_money(campaign.cost)} over the window at {campaign.clicks} clicks. "
                    "Any rate computed on this sample is noise.",
                )
            )
            continue

        cost_per = _per_unit(campaign.cost, conversions)
        if cost_per <= ceiling:
            diagnosis.signals.append(
                Signal(
                    "good",
                    "CHANNEL",
                    f"{campaign.campaign_name}: cost per {label} is {_money(cost_per)}, at or under the "
                    f"{ceiling} target.",
                    f"{conversions:.0f} {label}s for {_money(campaign.cost)}.",
                )
            )
            diagnosis.actions.append(
                ActionItem(
                    2,
                    f"Step {campaign.campaign_name} budget up by 20%",
                    f"Cost per {label} ({_money(cost_per)}) is inside target ({_money(ceiling)}), so more budget buys "
                    "more of a thing that works. Step by 20% at most — a larger jump resets the "
                    "learning phase and the next reading will not be comparable to this one. "
                    f"`./therrads campaign budget \"{campaign.campaign_name}\" --daily <new> --confirm`",
                    target="playbook",
                    kind="campaign",
                )
            )
        else:
            over = (cost_per / ceiling).quantize(Decimal("0.01")) if ceiling else Decimal("0")
            diagnosis.signals.append(
                Signal(
                    "critical" if over >= 2 else "warning",
                    "CHANNEL",
                    f"{campaign.campaign_name}: cost per {label} is {_money(cost_per)}, {over}x the "
                    f"{ceiling} target.",
                    f"{conversions:.0f} {label}s for {_money(campaign.cost)} at {campaign.clicks} clicks "
                    f"(CTR {campaign.ctr:.2%}).",
                )
            )
            diagnosis.actions.append(
                ActionItem(
                    1,
                    f"Decide: fix creative, narrow targeting, or stop {campaign.campaign_name}",
                    f"At {_money(cost_per)} per {label} against a {_money(ceiling)} ceiling this campaign cannot scale "
                    f"profitably as configured. Three levers in order of cost to try: (1) add a portrait "
                    "video asset if there is none — it is the largest single lever on App campaign CPI; "
                    "(2) narrow geography to the best-performing region and re-read; (3) if neither "
                    "moves it, the channel is priced out for this product and the next growth "
                    "experiment should be organic/referral, not more budget. Record which was chosen "
                    "and why, so the next reader is not re-deriving it.",
                    target="playbook",
                    kind="decision",
                )
            )


def _rule_ad_group_comparison(diagnosis: Diagnosis, ads, targets) -> None:
    """Compare keyword themes. This is the market-targeting experiment's readout."""
    spending = [g for g in ads.ad_groups if g.cost > 0]
    if len(spending) < 2:
        return

    converting = [g for g in spending if g.conversions > 0]
    if not converting:
        total_cost = sum((g.cost for g in spending), Decimal("0"))
        diagnosis.signals.append(
            Signal(
                "warning",
                "CHANNEL",
                f"All {len(spending)} ad groups spent ({_money(total_cost)} total) and none converted.",
                "Themes: " + ", ".join(g.ad_group_name for g in spending),
            )
        )
        diagnosis.actions.append(
            ActionItem(
                1,
                "Audit the landing page before spending more on search",
                "Every keyword theme is failing identically, which points past targeting to the "
                "destination: habits.therr.com has to convert a cold visitor who has never heard of a "
                "pact. Check that the page states the accountability premise above the fold and has a "
                "single visible call to action. Uniform failure across differently-intentioned themes "
                "is a landing-page signal, not a keyword signal.",
                target="wip",
                kind="code",
            )
        )
        return

    best = min(converting, key=lambda g: g.cost_per_conversion)
    worst = max(spending, key=lambda g: g.cost_per_conversion if g.conversions else Decimal("9" * 6))

    diagnosis.signals.append(
        Signal(
            "info",
            "CHANNEL",
            f"Best keyword theme is {best.ad_group_name!r} at {_money(best.cost_per_conversion)} per conversion.",
            "; ".join(
                f"{g.ad_group_name}: {_money(g.cost)} spent, {g.conversions:g} conv"
                for g in sorted(spending, key=lambda x: -x.cost)
            ),
        )
    )

    if worst.ad_group_name != best.ad_group_name and worst.conversions == 0 and worst.cost > 0:
        diagnosis.actions.append(
            ActionItem(
                2,
                f"Pause the {worst.ad_group_name!r} ad group and move its budget to {best.ad_group_name!r}",
                f"{worst.ad_group_name!r} has spent {_money(worst.cost)} with no conversion while "
                f"{best.ad_group_name!r} converts at {_money(best.cost_per_conversion)}. On a budget this size, "
                "the difference between themes IS the market-targeting finding: it says which framing "
                "the people who act respond to. Update the Play listing and the landing headline to "
                "match the winning theme's language, not just the ad copy.",
                target="playbook",
                kind="campaign",
            )
        )


def _rule_search_terms(diagnosis: Diagnosis, ads) -> None:
    """Find waste and find intent we are not bidding on."""
    if not ads.search_terms:
        return

    wasteful = [t for t in ads.search_terms if t.conversions == 0 and t.clicks >= 5]
    if wasteful:
        wasted = sum((t.cost for t in wasteful), Decimal("0"))
        share = _ratio(wasted, ads.total_cost) if ads.total_cost else Decimal("0")
        diagnosis.signals.append(
            Signal(
                "warning" if share > Decimal("0.20") else "info",
                "CHANNEL",
                f"{len(wasteful)} search terms took {_money(wasted)} ({share:.0%} of spend) with 5+ clicks "
                "and no conversion.",
                ", ".join(f"{t.search_term!r} ({t.clicks} clicks, {_money(t.cost)})" for t in wasteful[:8]),
            )
        )
        diagnosis.actions.append(
            ActionItem(
                2,
                "Add the non-converting search terms as negative keywords",
                "Listed in the signal above. Add them to the relevant ad group's negative_keywords in "
                "the campaign spec (so the change is version-controlled and survives a campaign "
                "rebuild), then re-apply. Read them before adding: a term that is obviously the wrong "
                "audience is waste, but a term with high intent and no conversion is a landing-page "
                "problem wearing a keyword costume.",
                target="playbook",
                kind="campaign",
            )
        )

    winners = [t for t in ads.search_terms if t.conversions > 0]
    if winners:
        diagnosis.signals.append(
            Signal(
                "good",
                "CHANNEL",
                f"{len(winners)} search terms converted — this is the real demand language.",
                ", ".join(f"{t.search_term!r} ({t.conversions:g})" for t in winners[:8]),
            )
        )
        diagnosis.actions.append(
            ActionItem(
                3,
                "Promote converting search terms to their own exact-match keywords",
                "The terms in the signal above are what people actually typed before converting. Add "
                "each as EXACT match in the spec so it gets its own bid, and reuse the phrasing "
                "verbatim in the Play listing short description and the landing headline — it is "
                "free, validated copy in the market's own words.",
                target="playbook",
                kind="campaign",
            )
        )


# ---------------------------------------------------------------------------
# DATA INTEGRITY — run before PRODUCT, because a data problem invalidates the
# product read rather than merely qualifying it.
# ---------------------------------------------------------------------------


def _rule_data_integrity(diagnosis: Diagnosis, ga4, funnel) -> None:
    if ga4 is not None:
        for warning in ga4.warnings:
            diagnosis.signals.append(
                Signal("warning", "DATA", "GA4 traffic quality", warning)
            )
        if ga4.warnings:
            diagnosis.actions.append(
                ActionItem(
                    1,
                    "Block the headless crawler at the edge before reading GA4 totals as growth",
                    "A GA4 data filter cannot exclude it (data filters only support Developer and "
                    "Internal traffic). Two mechanisms work: a Cloudflare or k8s ingress rule on the "
                    "source ASN/user-agent, which also removes the load; or pull the source IPs from "
                    "the ingress access logs into GA4 Admin -> Data streams -> Configure tag settings "
                    "-> Define internal traffic and enable the Internal Traffic filter. Already tracked "
                    "in docs/WORK_IN_PROGRESS.md § Analytics & traffic — this run is evidence it is "
                    "still open and is now distorting campaign reporting, not just historical totals.",
                    target="wip",
                    kind="manual",
                )
            )

    if funnel is None:
        return

    unattributed = funnel.unattributed
    attributed_signups = sum(r.signups for r in funnel.attributed)
    if unattributed and unattributed.signups:
        total = unattributed.signups + attributed_signups
        share = _ratio(unattributed.signups, total)
        diagnosis.signals.append(
            Signal(
                "critical" if share >= Decimal("0.7") else "warning",
                "DATA",
                f"{share:.0%} of signups ({unattributed.signups} of {total}) carry no utmCampaign.",
                "Every Play Store install from the app_install arm lands here, because the user never "
                "loads a web page that could set a UTM.",
            )
        )
        diagnosis.actions.append(
            ActionItem(
                1,
                "Wire the Play Install Referrer into TherrMobile so paid installs are attributable",
                "Today the app_install arm is unmeasurable past the install: Google Ads reports the "
                "install, and the account it creates is indistinguishable from an organic one. The "
                "Play Install Referrer API returns the referrer string Google Ads sets at install "
                "time; parsing it on first launch and posting it in the registration payload's "
                "userAcquisition object (the endpoint and sanitizer already exist — see "
                "main.userAcquisition and sanitizeUserAcquisition) closes the loop with no backend "
                "change. Until this exists, every conclusion about paid-install quality is inference. "
                "Mobile-only change: it belongs on niche/HABITS-general, not general.",
                target="wip",
                kind="code",
            )
        )


# ---------------------------------------------------------------------------
# PRODUCT
# ---------------------------------------------------------------------------


def _rule_app_activation(diagnosis: Diagnosis, app_funnel, targets) -> None:
    """PRODUCT, from the GA4 in-app funnel.

    This is the only evidence that exists about the app_install arm's users. A
    Play install sets no UTM, so `main."userAcquisition"` never sees them and
    the product-database rule below is structurally blind to the entire volume
    arm. What GA4's app stream can see — install, profile start, phone verify,
    invite — is therefore not a nice-to-have breakdown, it is the whole answer.

    Two things this rule refuses to do:
      - Read an un-emitted event as a zero. `habit_pact_create` does not exist
        in the shipped app; "0 pacts" would be a false finding about the
        product rather than a true one about the instrumentation.
      - Judge on a handful of installs. The install count, not the activation
        count, is the sample here, and it is gated on the same threshold as
        everything else.
    """
    if app_funnel is None:
        return

    installs = app_funnel.installs
    if not installs:
        return

    pact_step = app_funnel.step(ACTIVATION_EVENT)
    proxy_step = app_funnel.step(ACTIVATION_PROXY_EVENT)
    using_proxy = pact_step is None or not pact_step.instrumented

    # The instrumentation gap is a fact regardless of sample size, and it is the
    # thing that has to be fixed before any of this gets sharper. Report it
    # before the verdict so the verdict is read with it in view.
    missing = [name for name in app_funnel.missing_events() if name != ACTIVATION_PROXY_EVENT]
    if missing:
        diagnosis.signals.append(
            Signal(
                "warning",
                "DATA",
                f"{len(missing)} in-app funnel events have never fired: " + ", ".join(missing) + ".",
                f"GA4 property {app_funnel.property_id}, stream '{app_funnel.stream_name}'. These "
                "are absent from TherrMobile, not absent from the data — the funnel is truncated, "
                "not zero. Without habit_pact_create the PRODUCT question is answered by a proxy, "
                "and without habits_founder_unlock_purchase the MODEL question has no GA4 answer "
                "at all.",
            )
        )
        diagnosis.actions.append(
            ActionItem(
                1,
                "Instrument the habits activation and purchase events in TherrMobile",
                "Add logEvent calls for " + ", ".join(missing) + " alongside the existing "
                "profile_create_start / phone_verify_success calls, and mark them as key events in "
                "GA4 admin so Google Ads can import them as conversion actions. Include value: 20 "
                "and currency: 'USD' on the purchase event so it imports as a value conversion. "
                "Until these exist the App campaign can only bid on installs, and no amount of "
                "spend produces an answer to the MODEL question. Mobile-only change: it belongs on "
                "niche/HABITS-general, not general.",
                target="wip",
                kind="code",
            )
        )

    signups = app_funnel.users_at("profile_create_start")
    activated = proxy_step.users if using_proxy else pact_step.users
    activation_label = "sent an invite" if using_proxy else "created a pact"

    if installs < targets.min_conversions_for_verdict:
        diagnosis.signals.append(
            Signal(
                "info",
                "PRODUCT",
                f"{installs} installs is below the {targets.min_conversions_for_verdict} threshold "
                "for a verdict on the in-app funnel.",
                f"{signups} started a profile, {activated} {activation_label}. Reported, not judged.",
            )
        )
        diagnosis.verdicts.append(
            Verdict(
                "PRODUCT",
                "INSUFFICIENT_DATA",
                f"{installs} installs in this window is too small a sample to conclude anything "
                "about what bought users do.",
            )
        )
        return

    signup_rate = _ratio(signups, installs)
    activation_rate = _ratio(activated, signups)
    install_to_activation = _ratio(activated, installs)
    proxy_caveat = (
        " Measured by invites sent, because habit_pact_create is not instrumented — the real "
        "pact rate can only be lower, never higher, since a pact requires an invite."
        if using_proxy else ""
    )

    diagnosis.signals.append(
        Signal(
            "good" if signup_rate >= targets.min_install_to_signup_rate else "warning",
            "PRODUCT",
            f"{signup_rate:.0%} of installs started a profile "
            f"(target {targets.min_install_to_signup_rate:.0%}).",
            f"{signups} of {installs} installs, GA4 stream '{app_funnel.stream_name}'.",
        )
    )

    healthy = activation_rate >= targets.min_signup_to_pact_rate
    diagnosis.signals.append(
        Signal(
            "good" if healthy else "critical",
            "PRODUCT",
            f"{activation_rate:.0%} of in-app signups {activation_label} "
            f"(target {targets.min_signup_to_pact_rate:.0%}).",
            f"{activated} of {signups} signups; {install_to_activation:.1%} of all installs."
            + proxy_caveat,
        )
    )

    if healthy and signup_rate >= targets.min_install_to_signup_rate:
        diagnosis.verdicts.append(
            Verdict(
                "PRODUCT",
                "VIABLE",
                f"The in-app funnel clears both gates: {signup_rate:.0%} install-to-signup and "
                f"{activation_rate:.0%} signup-to-activation. Cold users survive the onboarding.",
            )
        )
        return

    if healthy:
        diagnosis.verdicts.append(
            Verdict(
                "PRODUCT",
                "AT_RISK",
                f"Users who sign up activate at {activation_rate:.0%}, but only {signup_rate:.0%} of "
                "installs sign up at all. The leak is above the pact mechanic, in the registration "
                "wall — a cheaper install does not fix it.",
            )
        )
        diagnosis.actions.append(
            ActionItem(
                2,
                "Cut the registration wall between install and first value",
                f"{installs - signups} of {installs} installs never started a profile. Every one was "
                "paid for and none is reachable again. Measure where they stop — the phone "
                "verification step is the largest single drop in the current funnel — and move as "
                "much of it as possible after first value rather than before it. "
                "Mobile-only: niche/HABITS-general.",
                target="wip",
                kind="code",
            )
        )
        return

    # The expensive case, and the one the whole exercise exists to detect.
    cost_note = ""
    if install_to_activation:
        implied = _per_unit(targets.max_cpi, install_to_activation)
        cost_note = (
            f" At the {_money(targets.max_cpi)} target CPI that is {_money(implied)} per user who "
            f"{activation_label} — before anyone pays anything."
        )
    diagnosis.verdicts.append(
        Verdict(
            "PRODUCT",
            "UNVIABLE",
            f"Only {activation_rate:.0%} of in-app signups {activation_label}, against a "
            f"{targets.min_signup_to_pact_rate:.0%} target.{cost_note} The onboarding asks for a "
            "partner before the app does anything, and cold users do not have one to hand. This is "
            "a product finding, not a targeting one — buying more installs multiplies it.",
        )
    )
    diagnosis.actions.append(
        ActionItem(
            1,
            "Fix the partner-wall onboarding before buying more installs",
            f"{activated} of {signups} signups {activation_label}. Paid traffic is strictly colder "
            "than the organic traffic that produced this rate, so it will not do better. Two "
            "changes are testable independently: let a new user create and track a habit solo "
            "before any invite is required, so the app has value at minute one; and make the "
            "invite step share a link out to where the friend already is rather than requiring "
            "contacts permission. Hold or reduce campaign budget until one of them moves this "
            "number — spend is currently buying installs that stop at the same wall.",
            target="playbook",
            kind="decision",
        )
    )


def _rule_product_funnel(diagnosis: Diagnosis, ads, funnel, targets) -> None:
    if funnel is None or not funnel.attributed:
        # Only claim the question is unanswerable if the app funnel has not
        # already answered it. Two PRODUCT verdicts in one report, one of them
        # "no data", reads as a contradiction rather than as two sources.
        if not _has_verdict(diagnosis, "PRODUCT"):
            diagnosis.verdicts.append(
                Verdict(
                    "PRODUCT",
                    "INSUFFICIENT_DATA",
                    "No campaign-attributed signups were read from the product database, so what paid "
                    "users do after arriving is unknown. Enable product_db in settings.yaml and run the "
                    "web_landing arm — the app_install arm cannot answer this question at all.",
                )
            )
        return

    signups = sum(r.signups for r in funnel.attributed)
    activated = sum(r.activated for r in funnel.attributed)
    unlocked = sum(r.unlocked for r in funnel.attributed)
    checked_in = sum(r.checked_in for r in funnel.attributed)

    if signups < targets.min_conversions_for_verdict:
        diagnosis.verdicts.append(
            Verdict(
                "PRODUCT",
                "INSUFFICIENT_DATA",
                f"{signups} attributed signups is below the {targets.min_conversions_for_verdict} "
                "threshold for a verdict. Keep the web arm running rather than drawing a conclusion.",
            )
        )
        return

    activation = _ratio(activated, signups)
    unlock = _ratio(unlocked, signups)
    retention = _ratio(checked_in, signups)

    diagnosis.signals.append(
        Signal(
            "good" if activation >= targets.min_signup_to_pact_rate else "critical",
            "PRODUCT",
            f"{activation:.0%} of paid signups created or joined a pact "
            f"(target {targets.min_signup_to_pact_rate:.0%}).",
            f"{activated} of {signups} signups. {checked_in} ({retention:.0%}) completed at least "
            f"one check-in.",
        )
    )

    if activation < targets.min_signup_to_pact_rate:
        diagnosis.verdicts.append(
            Verdict(
                "PRODUCT",
                "AT_RISK",
                f"Paid users sign up and then stop: only {activation:.0%} reach a pact against a "
                f"{targets.min_signup_to_pact_rate:.0%} target. The app does essentially nothing until "
                "a partner accepts, so a cold user acquired alone hits a wall a warm invited user "
                "never sees. This is the central tension in the product: the mandatory-partner "
                "mechanic is what makes organic growth possible AND what makes paid acquisition "
                "expensive, because you are buying one half of a two-person unit.",
            )
        )
        diagnosis.actions.append(
            ActionItem(
                1,
                "Give cold paid arrivals something to do before a partner accepts",
                f"Only {activation:.0%} of bought signups reach a pact. Options in ascending cost: "
                "(a) let a solo habit be tracked immediately for paid arrivals and surface the "
                "3-invite unlock as progress rather than a gate; (b) seed the first pact against a "
                "public challenge so the partner is not a blocker; (c) prefill the invite step with "
                "share targets rather than an empty contact picker. Any of these is cheaper than "
                "buying twice as many installs to compensate for the drop.",
                target="wip",
                kind="code",
            )
        )
    else:
        diagnosis.verdicts.append(
            Verdict(
                "PRODUCT",
                "VIABLE",
                f"{activation:.0%} of paid signups reach a pact, at or above target. Bought users "
                "behave like the product expects, so growth spend is not being wasted on the wrong "
                "audience.",
            )
        )

    diagnosis.signals.append(
        Signal(
            "good" if unlock >= targets.min_signup_to_unlock_rate else "warning",
            "PRODUCT",
            f"{unlock:.0%} of paid signups invited 3+ distinct people, the solo-tracking unlock "
            f"(target {targets.min_signup_to_unlock_rate:.0%}).",
            f"{unlocked} of {signups}. This is the closest available proxy for the viral loop: each "
            "of those invites is a chance at a free user.",
        )
    )
    if unlock < targets.min_signup_to_unlock_rate:
        diagnosis.actions.append(
            ActionItem(
                2,
                "Measure the true viral coefficient before scaling paid spend",
                f"Only {unlock:.0%} of paid signups reach 3 invites, so paid users are not currently "
                "subsidising themselves by bringing free ones. The whole case for paid acquisition on "
                "this product is that a bought user brings unbought users — if k is well below 1, "
                "every user costs full price and the economics are simply CAC vs LTV. Add an "
                "invites-accepted-per-acquired-user number to this report (main.invites.isAccepted "
                "joined to the cohort) so the coefficient is measured rather than assumed.",
                target="wip",
                kind="code",
            )
        )


# ---------------------------------------------------------------------------
# MODEL — the unit economics question.
# ---------------------------------------------------------------------------


def _rule_unit_economics(diagnosis: Diagnosis, ads, funnel, targets) -> None:
    if funnel is None or not funnel.attributed:
        diagnosis.verdicts.append(
            Verdict(
                "MODEL",
                "INSUFFICIENT_DATA",
                "No attributed revenue data. The business-model question cannot be answered from ad "
                "metrics alone.",
            )
        )
        return

    signups = sum(r.signups for r in funnel.attributed)
    payers = sum(r.payers for r in funnel.attributed)
    revenue = sum((r.revenue for r in funnel.attributed), Decimal("0"))
    spend = ads.total_cost

    if signups < targets.min_conversions_for_verdict:
        diagnosis.verdicts.append(
            Verdict(
                "MODEL",
                "INSUFFICIENT_DATA",
                f"{signups} attributed signups and {payers} payers is too small to price anything.",
            )
        )
        return

    payer_rate = _ratio(payers, signups)
    diagnosis.signals.append(
        Signal(
            "good" if payer_rate >= targets.min_activation_to_payer_rate else "warning",
            "MODEL",
            f"{payer_rate:.1%} of paid signups bought the Founder Unlock "
            f"(target {targets.min_activation_to_payer_rate:.1%}).",
            f"{payers} payers, {_money(revenue)} revenue, against {_money(spend)} of ad spend in the same window.",
        )
    )

    if payers == 0:
        # Cost per payer is undefined, but the lower bound is not: every dollar
        # spent so far has produced none, so CAC is already at least total spend.
        diagnosis.verdicts.append(
            Verdict(
                "MODEL",
                "UNVIABLE" if spend > FOUNDER_UNLOCK_NET * 3 else "INSUFFICIENT_DATA",
                f"{_money(spend)} spent, zero Founder Unlock purchases from attributed users. The unlock nets "
                f"{FOUNDER_UNLOCK_NET} after Play's 15% fee and is a ONE-TIME payment, so there is no "
                "second transaction to amortise acquisition against. Paid acquisition cannot fund "
                "itself at this conversion rate; it can still be worth running as a way to buy usage "
                "data, but it should be budgeted as research, not as growth.",
            )
        )
        diagnosis.actions.append(
            ActionItem(
                1,
                "Decide whether paid acquisition is a growth channel or a research budget",
                f"With a one-time {FOUNDER_UNLOCK_PRICE} unlock netting {FOUNDER_UNLOCK_NET}, paid "
                "acquisition only works if CAC per payer stays under that — a bar recurring-revenue "
                "products do not have to clear. Two structural responses, and they are different "
                "businesses: (1) ship the $6.99/mo premium tier so LTV can exceed a single "
                "transaction, which is what makes paid acquisition mathematically possible; "
                "(2) accept that growth is organic/referral and cap paid spend at whatever the "
                "usage data is worth to you. Record the choice here — it determines whether the "
                "premium tier is the next feature or a later one.",
                target="playbook",
                kind="decision",
            )
        )
        return

    cost_per_payer = _per_unit(spend, payers)
    if cost_per_payer <= FOUNDER_UNLOCK_NET:
        diagnosis.verdicts.append(
            Verdict(
                "MODEL",
                "VIABLE",
                f"Cost per payer is {_money(cost_per_payer)} against {FOUNDER_UNLOCK_NET} net revenue per "
                "Founder Unlock. Paid acquisition pays for itself on the first transaction, before "
                "counting any user the payer invites. Scale carefully — CAC rises as the cheapest "
                "audience is exhausted, so re-read this ratio at every budget step.",
            )
        )
        diagnosis.actions.append(
            ActionItem(
                1,
                "Scale budget while cost per payer stays under the unlock's net value",
                f"At {_money(cost_per_payer)} per payer against {FOUNDER_UNLOCK_NET} net, each 20% budget step "
                "is a positive-return decision. Step, wait a full learning period, re-read. Stop "
                "stepping the moment cost per payer crosses the net value — that crossing is the "
                "real ceiling of this channel, and finding it is more valuable than any single "
                "month's growth.",
                target="playbook",
                kind="campaign",
            )
        )
    else:
        diagnosis.verdicts.append(
            Verdict(
                "MODEL",
                "UNVIABLE",
                f"Cost per payer is {_money(cost_per_payer)}, above the {FOUNDER_UNLOCK_NET} net value of the "
                f"one-time Founder Unlock. Every paid customer loses "
                f"{(cost_per_payer - FOUNDER_UNLOCK_NET).quantize(Decimal('0.01'))} on first purchase, "
                "and with no recurring tier shipped there is nothing later to recover it from. The "
                "gap is a pricing and packaging problem before it is a marketing problem.",
            )
        )
        diagnosis.actions.append(
            ActionItem(
                1,
                "Ship the recurring premium tier, or stop treating paid acquisition as growth",
                f"Cost per payer ({_money(cost_per_payer)}) exceeds what a customer is worth "
                f"({FOUNDER_UNLOCK_NET} net, once). This is the clearest pivot signal the data can "
                "produce, and it is about the model, not the ads: a one-time-purchase product cannot "
                "sustain paid acquisition unless CAC is very low. The $6.99/mo tier is specified in "
                "docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md and not yet built — building it changes "
                "the arithmetic. Until it exists, cap paid spend at the value of the learning.",
                target="playbook",
                kind="decision",
            )
        )
