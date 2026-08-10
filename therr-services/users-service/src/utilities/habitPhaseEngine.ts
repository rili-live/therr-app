/**
 * The habit lifecycle engine — decides, for one (user, habit), what phase the
 * habit is in and what the app is allowed to say about it today.
 *
 * Full rationale and the research it is built on: docs/HABIT_LIFECYCLE_MESSAGING.md.
 * The short version, because the numbers below look arbitrary otherwise:
 *
 * "It takes 21 days to form a habit" is not a finding. It traces to Maxwell
 * Maltz's 1960 "Psycho-Cybernetics", observing that plastic-surgery patients
 * took about 21 days to stop seeing their old face in the mirror. The actual
 * measurement is Lally et al. (2010), which tracked 96 people performing a
 * self-chosen daily behaviour for 12 weeks and modelled automaticity per
 * individual: a median of **66 days** to reach 95% of asymptote, with a range
 * of **18 to 254 days**. Missing a single day did not measurably harm
 * formation.
 *
 * That range is why this file evaluates each habit against the user's own
 * behaviour instead of a fixed calendar. A hard 21-day cutoff would declare
 * victory for someone still mid-formation (the median case) while making
 * someone at the fast end wait longer than they needed. So the gates below pair
 * a *floor* (the earliest the literature ever observed the outcome) with an
 * *observed consistency* test over a trailing window.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PHASES
 *
 *   forming      Daily nudging. The default, and where a rebuilding habit
 *                returns to after a lapse.
 *   established  The adaptive gate passed. Nudging TAPERS — this is the phase
 *                that exists to stop over-sending to people who have already
 *                succeeded.
 *   maintaining  Automaticity proxy passed. Daily nudging STOPS; only the
 *                30/60/90-day maintenance check-ins remain.
 *   lapsed       A previously-established habit has dropped off. No nudging;
 *                the comeback offer handles this phase, at most monthly.
 *
 * The one-way door to watch: `established` and `maintaining` both REDUCE the
 * app's permission to send. Every gate here is therefore written so that
 * failing to evaluate leaves a habit in the *more* talkative phase — the safe
 * direction for a bug is over-reminding a user, not silently going quiet on
 * someone who still needs the support.
 */

export type HabitPhase = 'forming' | 'established' | 'maintaining' | 'lapsed';

// ── Establish gate (forming → established) ──────────────────────────────────
// 21 days is kept, but demoted from "the rule" to "the floor". It is the round
// number closest to the fastest automaticity Lally actually observed (18 days),
// so treating it as the earliest a habit may be called established is
// defensible; treating it as the moment every habit becomes one is not.
export const ESTABLISH_DAY_FLOOR = 21;
export const ESTABLISH_WINDOW_DAYS = 14;
// 90% over a fortnight — 13 of 14 days. High on purpose: this gate spends the
// user's safety net, so it should require evidence rather than a passing grade.
export const ESTABLISH_MIN_CONSISTENCY = 0.9;

// ── Automaticity gate (established → maintaining) ───────────────────────────
// 66 is Lally's median time to 95% of automaticity asymptote. Paired with a
// longer, slightly more forgiving window: by this point we are confirming a
// plateau rather than detecting a trend, and Lally also found that missing an
// occasional day does not derail formation — so demanding 90% here would punish
// exactly the noise the study says is harmless.
export const AUTOMATICITY_DAY_FLOOR = 66;
export const AUTOMATICITY_WINDOW_DAYS = 28;
export const AUTOMATICITY_MIN_CONSISTENCY = 0.85;

// ── Lapse detection ─────────────────────────────────────────────────────────
// Under half of a trailing fortnight — 8+ missed days out of 14. Deliberately
// far below the establish bar rather than just under it: the gap between the
// two is hysteresis, so a habit hovering around one threshold cannot oscillate
// between "congratulations" and "want to restart?" week over week.
export const LAPSE_WINDOW_DAYS = 14;
export const LAPSE_MAX_CONSISTENCY = 0.5;
// Coming back from lapsed lands in `forming`, not straight back to established:
// a rebuilding habit wants the daily support it had the first time, and the
// establish gate will re-fire on its own once the evidence is there again.
export const RECOVERY_MIN_CONSISTENCY = 0.5;

// ── Maintenance check-ins ───────────────────────────────────────────────────
// Counted from `establishedAt` — the day nudging tapered — because the question
// these ask is "did it hold after we backed off?". Counting from habit creation
// would instead ask "is it still going?", which the streak already answers.
//
// The 30/60/90 shape follows the extended-contact / booster literature: support
// tapered rather than withdrawn keeps behaviour-change gains measurably longer,
// and 3-6 months post-change is the window where relapse concentrates.
export const MAINTENANCE_STAGES = [30, 60, 90];

// ── Comeback offers ─────────────────────────────────────────────────────────
// At most one a month. A lapsed user is by definition not engaging, and the
// fastest route to a permanent opt-out is repeated low-relevance messaging to
// someone who has already stopped listening.
export const COMEBACK_MIN_INTERVAL_DAYS = 30;

/**
 * How often a phase permits a daily-style nudge, in days. 0 means never.
 *
 * `established` at 3 is the taper itself: a two-thirds cut in per-habit nudging
 * at the moment the user has demonstrated they need it least. This is the
 * lever that keeps a multi-habit user under the queue worker's per-user daily
 * cap without that cap having to silently drop their most urgent reminder.
 */
export const NUDGE_CADENCE_DAYS: Record<HabitPhase, number> = {
    forming: 1,
    established: 3,
    maintaining: 0,
    lapsed: 0,
};

export interface IPhaseEvaluationInput {
    /** Stored phase. Absent/unknown is treated as 'forming'. */
    phase: HabitPhase;
    establishedAt: string | null;
    automaticityAt: string | null;
    maintenanceStage: number;
    lastComebackAt: string | null;
    /** Age of the habit in days — days since the user's first check-in on it. */
    habitAgeDays: number;
    /** Completed check-ins within the trailing ESTABLISH/LAPSE window. */
    completionsShortWindow: number;
    /** Completed check-ins within the trailing AUTOMATICITY window. */
    completionsLongWindow: number;
    /** Today, as YYYY-MM-DD. Passed in so evaluation is deterministic in tests. */
    today: string;
}

export interface IPhaseDecision {
    nextPhase: HabitPhase;
    /** True when nextPhase differs from the stored phase. */
    transitioned: boolean;
    /** Set on the run that crosses a gate — drives the celebration push. */
    milestone?: 'established' | 'automaticity';
    /** 30 | 60 | 90 when a maintenance check-in is due this run. */
    maintenanceDue?: number;
    /** True when a comeback offer should go out this run. */
    comebackDue: boolean;
    /** Whether a streak-at-risk style nudge is permitted today. */
    allowsDailyNudge: boolean;
    /** Trailing short-window consistency, 0-100, for copy interpolation. */
    consistencyPercent: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between two YYYY-MM-DD dates. Both are parsed as UTC midnight, so
 * this is a pure calendar-day difference with no timezone drift — the digest
 * runs once a day and must not produce a different answer either side of it.
 */
export const daysBetween = (fromDate: string, toDate: string): number => {
    const from = Date.parse(`${String(fromDate).slice(0, 10)}T00:00:00.000Z`);
    const to = Date.parse(`${String(toDate).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(from) || Number.isNaN(to)) return 0;
    return Math.floor((to - from) / MS_PER_DAY);
};

/**
 * Completion rate over a trailing window.
 *
 * The denominator is capped at the habit's own age, so a habit that is 5 days
 * old is judged on 5 days rather than being scored 5/14 and looking like a
 * failure. It cannot exceed 1: a user may complete more than one check-in in a
 * day (two pacts on one goal), and an uncapped rate would let that buy its way
 * through a gate that is meant to measure *days covered*.
 */
export const consistencyRate = (completions: number, windowDays: number, habitAgeDays: number): number => {
    const denominator = Math.min(windowDays, Math.max(habitAgeDays, 0));
    if (denominator <= 0) return 0;
    return Math.min(completions / denominator, 1);
};

/**
 * Does this phase permit a nudge today?
 *
 * Anchored on days-since-established rather than on a rolling counter so the
 * answer is a pure function of the calendar: the digest is at-least-once, and a
 * cadence that counted invocations would drift every time a run was retried.
 */
export const allowsNudgeToday = (
    phase: HabitPhase,
    establishedAt: string | null,
    today: string,
): boolean => {
    const cadence = NUDGE_CADENCE_DAYS[phase] ?? 1;
    if (cadence <= 0) return false;
    if (cadence === 1) return true;
    // An established phase always has an establishedAt; if it somehow does not,
    // fall back to nudging rather than going silent.
    if (!establishedAt) return true;
    return daysBetween(establishedAt, today) % cadence === 0;
};

/**
 * The highest maintenance stage now due, or undefined.
 *
 * Highest-not-yet-sent rather than lowest: if a habit goes 95 days past its
 * taper without the sweep running (an outage, a paused scheduler, a feature
 * flag switched on late), the user should receive one 90-day check-in, not a
 * burst of 30, 60 and 90 in the same hour. Backlog collapses into the most
 * recent milestone that is actually true.
 */
export const dueMaintenanceStage = (daysSinceEstablished: number, maintenanceStage: number): number | undefined => {
    const due = MAINTENANCE_STAGES
        .filter((stage) => stage > maintenanceStage && daysSinceEstablished >= stage);
    return due.length ? due[due.length - 1] : undefined;
};

/**
 * Evaluate one habit's lifecycle for today.
 *
 * Pure: every input is passed in, including `today`. All the I/O — reading
 * check-in counts, persisting the new phase, enqueuing notifications — is the
 * caller's job (see habitsDigest.ts), which keeps the policy that decides when
 * to talk to a user testable without a database.
 */
export const evaluateHabitPhase = (input: IPhaseEvaluationInput): IPhaseDecision => {
    const {
        establishedAt,
        maintenanceStage,
        lastComebackAt,
        habitAgeDays,
        completionsShortWindow,
        completionsLongWindow,
        today,
    } = input;

    const phase: HabitPhase = NUDGE_CADENCE_DAYS[input.phase] === undefined ? 'forming' : input.phase;

    const shortRate = consistencyRate(completionsShortWindow, ESTABLISH_WINDOW_DAYS, habitAgeDays);
    const longRate = consistencyRate(completionsLongWindow, AUTOMATICITY_WINDOW_DAYS, habitAgeDays);
    const consistencyPercent = Math.round(shortRate * 100);

    let nextPhase: HabitPhase = phase;
    let milestone: IPhaseDecision['milestone'];
    let comebackDue = false;

    if (phase === 'lapsed') {
        // Recovery first: someone checking in again should stop being treated as
        // dormant before anything else is decided about them.
        if (shortRate >= RECOVERY_MIN_CONSISTENCY) {
            nextPhase = 'forming';
        } else {
            const neverOffered = !lastComebackAt;
            const dueAgain = !neverOffered
                && daysBetween(lastComebackAt as string, today) >= COMEBACK_MIN_INTERVAL_DAYS;
            comebackDue = neverOffered || dueAgain;
        }
    } else {
        // A lapse can only be declared against a habit that was established at
        // some point. A brand-new user having a bad first fortnight is still
        // forming, and telling them to "restart" a habit they have not built yet
        // would be both wrong and discouraging.
        const isEstablishedOrBeyond = phase === 'established' || phase === 'maintaining';
        const hasEnoughHistory = habitAgeDays >= LAPSE_WINDOW_DAYS;

        if (isEstablishedOrBeyond && hasEnoughHistory && shortRate < LAPSE_MAX_CONSISTENCY) {
            nextPhase = 'lapsed';
            // The comeback offer rides the transition itself. By the time this
            // fires the user has already missed 8+ of the last 14 days, which
            // lands it in the same window the re-engagement literature targets.
            comebackDue = !lastComebackAt
                || daysBetween(lastComebackAt, today) >= COMEBACK_MIN_INTERVAL_DAYS;
        } else if (
            phase === 'established'
            && habitAgeDays >= AUTOMATICITY_DAY_FLOOR
            && longRate >= AUTOMATICITY_MIN_CONSISTENCY
        ) {
            nextPhase = 'maintaining';
            milestone = 'automaticity';
        } else if (
            phase === 'forming'
            && habitAgeDays >= ESTABLISH_DAY_FLOOR
            && shortRate >= ESTABLISH_MIN_CONSISTENCY
        ) {
            nextPhase = 'established';
            milestone = 'established';
        }
    }

    // Maintenance check-ins are evaluated against the phase we are landing in,
    // and only once a taper anchor exists. A habit that lapsed this run is
    // excluded: it gets the comeback offer instead, and asking "still going?" in
    // the same breath as "want to restart?" would be incoherent.
    let maintenanceDue: number | undefined;
    const anchor = nextPhase === 'established' && milestone === 'established' ? today : establishedAt;
    if ((nextPhase === 'established' || nextPhase === 'maintaining') && anchor) {
        maintenanceDue = dueMaintenanceStage(daysBetween(anchor, today), maintenanceStage);
    }

    // A run that celebrates a gate should not also nudge about the same habit —
    // the milestone copy is what announces the cadence change, so pairing it
    // with the very reminder it says is easing off reads as a broken promise.
    const allowsDailyNudge = !milestone
        && !comebackDue
        && maintenanceDue === undefined
        && allowsNudgeToday(nextPhase, nextPhase === 'established' && milestone ? today : establishedAt, today);

    return {
        nextPhase,
        transitioned: nextPhase !== phase,
        milestone,
        maintenanceDue,
        comebackDue,
        allowsDailyNudge,
        consistencyPercent,
    };
};

export default evaluateHabitPhase;
