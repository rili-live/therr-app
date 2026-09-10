"""Currency conversion and the spend guard rails.

Pure functions with no API dependency, because this is the layer that decides
how much real money gets spent and it must be unit-testable without credentials.

THE MICROS TRAP
Google Ads expresses every monetary value in "micros" — millionths of the
account currency unit. $12.50 is 12_500_000. Two failure modes have to be
designed out rather than commented around:

  1. Passing dollars where micros are expected under-spends by 1,000,000x, which
     looks like a campaign that simply never serves. Harmless but confusing.
  2. Passing micros where dollars are expected over-spends by 1,000,000x. That
     one is a five-figure bill.

So dollars never cross into the API layer as a bare number: `to_micros` is the
only way in, and `check_budget` runs before any mutate that changes spend.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

MICROS_PER_UNIT = 1_000_000

# Google Ads rounds every budget to the nearest 10,000 micros ($0.01) server
# side. Doing it here too keeps what we print identical to what the account ends
# up holding, so a diff of "planned vs actual" is never noise.
MICROS_QUANTUM = 10_000


class BudgetError(ValueError):
    """Raised when a requested budget violates a configured guard rail."""


def to_micros(amount) -> int:
    """Convert an account-currency amount to micros, truncated to the cent quantum.

    Accepts str/int/float/Decimal. Uses Decimal internally: float arithmetic
    turns 20.10 into 20.099999999999998, which truncates to 20_099_999 micros —
    a cent short, and enough to make an equality assertion fail confusingly.
    """
    try:
        value = Decimal(str(amount))
    except (InvalidOperation, TypeError) as exc:
        raise BudgetError(f"not a monetary amount: {amount!r}") from exc

    if value < 0:
        raise BudgetError(f"negative amount: {amount!r}")

    micros = (value * MICROS_PER_UNIT).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return int(micros) // MICROS_QUANTUM * MICROS_QUANTUM


def from_micros(micros: int) -> Decimal:
    """Convert micros back to an account-currency Decimal, for display."""
    return (Decimal(int(micros)) / MICROS_PER_UNIT).quantize(Decimal("0.01"))


def format_micros(micros: int, currency: str = "USD") -> str:
    return f"{from_micros(micros)} {currency}"


@dataclass
class BudgetLimits:
    """The guard rails from settings.yaml -> limits."""

    max_daily_budget: Decimal = Decimal("50.00")
    max_total_daily_budget: Decimal = Decimal("100.00")
    budget_change_warn_ratio: Decimal = Decimal("0.20")
    learning_period_days: int = 7

    @classmethod
    def from_dict(cls, raw: dict | None) -> "BudgetLimits":
        raw = raw or {}
        return cls(
            max_daily_budget=Decimal(str(raw.get("max_daily_budget", "50.00"))),
            max_total_daily_budget=Decimal(str(raw.get("max_total_daily_budget", "100.00"))),
            budget_change_warn_ratio=Decimal(str(raw.get("budget_change_warn_ratio", "0.20"))),
            learning_period_days=int(raw.get("learning_period_days", 7)),
        )


@dataclass
class BudgetDecision:
    """The outcome of checking a proposed budget. Never raises on warnings.

    `blocked` is a hard stop (over the configured ceiling). `warnings` are
    things the operator should see but may override with --force, chiefly the
    learning-phase reset. Keeping the two separate is what makes the tool
    "budget flexible" without being budget dangerous: raising spend is always
    possible, it is just never silent.
    """

    proposed_micros: int
    current_micros: int | None = None
    blocked: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def allowed(self) -> bool:
        return not self.blocked

    @property
    def needs_force(self) -> bool:
        return bool(self.warnings)

    @property
    def change_ratio(self) -> Decimal | None:
        if not self.current_micros:
            return None
        delta = abs(self.proposed_micros - self.current_micros)
        return (Decimal(delta) / Decimal(self.current_micros)).quantize(Decimal("0.001"))


def check_budget(
    proposed,
    limits: BudgetLimits,
    current_micros: int | None = None,
    other_campaigns_micros: int = 0,
    days_since_start: int | None = None,
    target_cpa=None,
) -> BudgetDecision:
    """Decide whether a proposed daily budget may be applied.

    `other_campaigns_micros` is the summed daily budget of every OTHER campaign
    this tool manages, so the account-wide ceiling is enforced rather than only
    the per-campaign one — two campaigns at the per-campaign max are still twice
    the intended burn.
    """
    proposed_micros = to_micros(proposed)
    decision = BudgetDecision(proposed_micros=proposed_micros, current_micros=current_micros)

    if proposed_micros <= 0:
        decision.blocked.append("Daily budget must be greater than zero.")
        return decision

    ceiling = to_micros(limits.max_daily_budget)
    if proposed_micros > ceiling:
        decision.blocked.append(
            f"Daily budget {format_micros(proposed_micros)} exceeds limits.max_daily_budget "
            f"({format_micros(ceiling)}). Raise the limit in settings.yaml deliberately if this is intended."
        )

    total = proposed_micros + max(0, int(other_campaigns_micros))
    total_ceiling = to_micros(limits.max_total_daily_budget)
    if total > total_ceiling:
        decision.blocked.append(
            f"Combined daily budget across managed campaigns would be {format_micros(total)}, over "
            f"limits.max_total_daily_budget ({format_micros(total_ceiling)})."
        )

    ratio = decision.change_ratio
    if ratio is not None and ratio > limits.budget_change_warn_ratio:
        direction = "increase" if proposed_micros > (current_micros or 0) else "decrease"
        decision.warnings.append(
            f"This is a {ratio:.1%} {direction} (from {format_micros(current_micros or 0)}). Google resets "
            f"the campaign's learning phase on changes over {limits.budget_change_warn_ratio:.0%}; expect "
            f"~3-7 days of unstable CPI before the new steady state. Prefer stepping in "
            f"<={limits.budget_change_warn_ratio:.0%} increments unless you are deliberately restarting learning."
        )

    if days_since_start is not None and 0 <= days_since_start < limits.learning_period_days:
        decision.warnings.append(
            f"Campaign is {days_since_start} day(s) old and still inside its "
            f"{limits.learning_period_days}-day learning period. Metrics are not yet a signal and edits "
            f"restart the clock. Strong preference: change nothing until day {limits.learning_period_days}."
        )

    if target_cpa is not None:
        # Google's own guidance for App campaigns: a daily budget below ~50x the
        # target CPA starves the bidder of the conversion volume it needs, and
        # the campaign under-delivers at a CPI well above target. This is the
        # most common reason a small App campaign "doesn't work".
        floor = to_micros(Decimal(str(target_cpa)) * 50)
        if proposed_micros < floor:
            decision.warnings.append(
                f"Daily budget {format_micros(proposed_micros)} is under 50x the target CPA "
                f"({format_micros(floor)} recommended for target CPA {target_cpa}). App campaigns "
                f"under-deliver below this ratio. Either raise the budget or raise the target CPA — a "
                f"lower target CPA with a small budget is the worst of both."
            )

    return decision
