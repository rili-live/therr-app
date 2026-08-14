/* eslint-disable max-len */
import { expect } from 'chai';
import {
    evaluateHabitPhase,
    allowsNudgeToday,
    consistencyRate,
    daysBetween,
    dueMaintenanceStage,
    HabitPhase,
    IPhaseEvaluationInput,
    ESTABLISH_DAY_FLOOR,
    ESTABLISH_WINDOW_DAYS,
    AUTOMATICITY_DAY_FLOOR,
    AUTOMATICITY_WINDOW_DAYS,
    MAINTENANCE_STAGES,
    COMEBACK_MIN_INTERVAL_DAYS,
} from '../../src/utilities/habitPhaseEngine';

/**
 * The habit lifecycle engine decides how often the app is allowed to talk to
 * someone about a habit. Two of its four phases *reduce* that permission, which
 * makes this the rare piece of notification logic where the expensive bug is
 * silence rather than spam: a habit wrongly promoted to `maintaining` stops
 * getting reminders and nobody reports it, because the user simply drifts.
 *
 * These tests therefore pin the gates from both sides — that they open when the
 * evidence is there, and that they stay shut when it is one day or one check-in
 * short — plus the invariants that stop the system contradicting itself in a
 * single run (celebrating and nudging together, or asking "still going?" and
 * "want to restart?" in the same breath).
 */

const TODAY = '2026-08-10';

const baseInput = (overrides: Partial<IPhaseEvaluationInput> = {}): IPhaseEvaluationInput => ({
    phase: 'forming',
    establishedAt: null,
    automaticityAt: null,
    maintenanceStage: 0,
    lastComebackAt: null,
    habitAgeDays: 0,
    completionsShortWindow: 0,
    completionsLongWindow: 0,
    today: TODAY,
    ...overrides,
});

// A date `days` before TODAY, for building establishedAt/lastComebackAt anchors.
const daysBefore = (days: number): string => new Date(Date.parse(`${TODAY}T00:00:00.000Z`) - (days * 24 * 60 * 60 * 1000))
    .toISOString()
    .slice(0, 10);

describe('habitPhaseEngine', () => {
    describe('daysBetween', () => {
        it('counts whole calendar days', () => {
            expect(daysBetween('2026-08-01', '2026-08-10')).to.equal(9);
        });

        it('is zero for the same day and negative going backwards', () => {
            expect(daysBetween('2026-08-10', '2026-08-10')).to.equal(0);
            expect(daysBetween('2026-08-11', '2026-08-10')).to.equal(-1);
        });

        it('ignores a time component rather than drifting across a timezone', () => {
            // The digest runs once a day; parsing these as local time would make
            // the answer depend on which side of midnight the pod happens to be.
            expect(daysBetween('2026-08-01T23:30:00.000Z', '2026-08-10T00:30:00.000Z')).to.equal(9);
        });

        it('returns 0 rather than NaN for an unparseable date', () => {
            expect(daysBetween('not-a-date', TODAY)).to.equal(0);
        });
    });

    describe('consistencyRate', () => {
        it('scores a young habit against its own age, not the full window', () => {
            // 5 of 5 days on a 5-day-old habit is 100%, not 5/14.
            expect(consistencyRate(5, ESTABLISH_WINDOW_DAYS, 5)).to.equal(1);
        });

        it('uses the full window once the habit is older than it', () => {
            expect(consistencyRate(7, ESTABLISH_WINDOW_DAYS, 100)).to.equal(0.5);
        });

        it('caps at 1 so multiple check-ins in a day cannot buy a gate', () => {
            // Two pacts on one goal produce two completions for one day covered.
            expect(consistencyRate(28, ESTABLISH_WINDOW_DAYS, 14)).to.equal(1);
        });

        it('is 0 for a habit with no age', () => {
            expect(consistencyRate(3, ESTABLISH_WINDOW_DAYS, 0)).to.equal(0);
        });
    });

    describe('establish gate', () => {
        it('opens at the day floor with 90% consistency', () => {
            const decision = evaluateHabitPhase(baseInput({
                habitAgeDays: ESTABLISH_DAY_FLOOR,
                completionsShortWindow: 13, // 13/14 = 92.8%
            }));

            expect(decision.nextPhase).to.equal('established');
            expect(decision.transitioned).to.equal(true);
            expect(decision.milestone).to.equal('established');
        });

        it('stays shut one day before the floor, however consistent', () => {
            // The floor is the whole reason 21 survives as a number. A perfect
            // 20-day run must not promote, or the floor is decorative.
            const decision = evaluateHabitPhase(baseInput({
                habitAgeDays: ESTABLISH_DAY_FLOOR - 1,
                completionsShortWindow: 14,
            }));

            expect(decision.nextPhase).to.equal('forming');
            expect(decision.milestone).to.equal(undefined);
        });

        it('stays shut past the floor when consistency is one day short', () => {
            const decision = evaluateHabitPhase(baseInput({
                habitAgeDays: 40,
                completionsShortWindow: 12, // 12/14 = 85.7%, under the 90% bar
            }));

            expect(decision.nextPhase).to.equal('forming');
        });

        it('keeps nudging daily while forming', () => {
            const decision = evaluateHabitPhase(baseInput({
                habitAgeDays: 10,
                completionsShortWindow: 8,
            }));

            expect(decision.allowsDailyNudge).to.equal(true);
        });
    });

    describe('automaticity gate', () => {
        it('opens at 66 days with 85% over the long window', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(45),
                habitAgeDays: AUTOMATICITY_DAY_FLOOR,
                completionsShortWindow: 13,
                completionsLongWindow: 24, // 24/28 = 85.7%
            }));

            expect(decision.nextPhase).to.equal('maintaining');
            expect(decision.milestone).to.equal('automaticity');
        });

        it('stays shut before 66 days even at perfect consistency', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(20),
                habitAgeDays: AUTOMATICITY_DAY_FLOOR - 1,
                completionsShortWindow: 14,
                completionsLongWindow: AUTOMATICITY_WINDOW_DAYS,
            }));

            expect(decision.nextPhase).to.equal('established');
            expect(decision.milestone).to.equal(undefined);
        });

        it('cannot be reached directly from forming', () => {
            // A habit must pass through the taper before nudging can stop, so a
            // long-lived but never-established habit stays in forming.
            const decision = evaluateHabitPhase(baseInput({
                phase: 'forming',
                habitAgeDays: 200,
                completionsShortWindow: 14,
                completionsLongWindow: AUTOMATICITY_WINDOW_DAYS,
            }));

            expect(decision.nextPhase).to.equal('established');
            expect(decision.milestone).to.equal('established');
        });

        it('silences daily nudging once maintaining', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'maintaining',
                establishedAt: daysBefore(100),
                maintenanceStage: 90,
                habitAgeDays: 150,
                completionsShortWindow: 13,
                completionsLongWindow: 26,
            }));

            expect(decision.allowsDailyNudge).to.equal(false);
        });
    });

    describe('taper cadence', () => {
        it('permits a nudge every third day once established', () => {
            const established = daysBefore(9); // 9 days ago → 9 % 3 === 0
            expect(allowsNudgeToday('established', established, TODAY)).to.equal(true);
            expect(allowsNudgeToday('established', daysBefore(10), TODAY)).to.equal(false);
            expect(allowsNudgeToday('established', daysBefore(11), TODAY)).to.equal(false);
            expect(allowsNudgeToday('established', daysBefore(12), TODAY)).to.equal(true);
        });

        it('nudges daily while forming and never while maintaining or lapsed', () => {
            expect(allowsNudgeToday('forming', null, TODAY)).to.equal(true);
            expect(allowsNudgeToday('maintaining', daysBefore(5), TODAY)).to.equal(false);
            expect(allowsNudgeToday('lapsed', daysBefore(5), TODAY)).to.equal(false);
        });

        it('falls back to nudging when an established row has no anchor', () => {
            // Safe direction for a bug: over-remind rather than go silent.
            expect(allowsNudgeToday('established', null, TODAY)).to.equal(true);
        });

        it('treats an unknown stored phase as forming', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'nonsense' as HabitPhase,
                habitAgeDays: 5,
                completionsShortWindow: 5,
            }));

            expect(decision.nextPhase).to.equal('forming');
            expect(decision.allowsDailyNudge).to.equal(true);
        });
    });

    describe('maintenance check-ins', () => {
        it('fires the 30-day check-in 30 days after the taper, not after habit creation', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(30),
                habitAgeDays: 51, // 21 forming + 30 established
                completionsShortWindow: 13,
            }));

            expect(decision.maintenanceDue).to.equal(30);
        });

        it('does not re-fire a stage already delivered', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(35),
                maintenanceStage: 30,
                habitAgeDays: 56,
                completionsShortWindow: 13,
            }));

            expect(decision.maintenanceDue).to.equal(undefined);
        });

        it('collapses a backlog into the highest due stage', () => {
            // A scheduler outage (or the flag switched on late) must not produce
            // three pushes in one hour.
            const decision = evaluateHabitPhase(baseInput({
                phase: 'maintaining',
                establishedAt: daysBefore(95),
                maintenanceStage: 0,
                habitAgeDays: 116,
                completionsShortWindow: 13,
                completionsLongWindow: 26,
            }));

            expect(decision.maintenanceDue).to.equal(90);
        });

        it('stops after the last stage', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'maintaining',
                establishedAt: daysBefore(400),
                maintenanceStage: 90,
                habitAgeDays: 421,
                completionsShortWindow: 13,
                completionsLongWindow: 26,
            }));

            expect(decision.maintenanceDue).to.equal(undefined);
        });

        it('exposes the stage helper as pure highest-not-yet-sent', () => {
            expect(dueMaintenanceStage(29, 0)).to.equal(undefined);
            expect(dueMaintenanceStage(30, 0)).to.equal(30);
            expect(dueMaintenanceStage(61, 30)).to.equal(60);
            expect(dueMaintenanceStage(200, 90)).to.equal(undefined);
            expect(MAINTENANCE_STAGES).to.deep.equal([30, 60, 90]);
        });
    });

    describe('lapse and comeback', () => {
        it('lapses an established habit that drops under half a fortnight', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(40),
                habitAgeDays: 61,
                completionsShortWindow: 6, // 6/14 = 42.8%
            }));

            expect(decision.nextPhase).to.equal('lapsed');
            expect(decision.comebackDue).to.equal(true);
        });

        it('never lapses a habit that was still forming', () => {
            // Telling a struggling newcomer to "restart" a habit they have not
            // built yet is both wrong and discouraging.
            const decision = evaluateHabitPhase(baseInput({
                phase: 'forming',
                habitAgeDays: 20,
                completionsShortWindow: 2,
            }));

            expect(decision.nextPhase).to.equal('forming');
            expect(decision.comebackDue).to.equal(false);
        });

        it('will not lapse before there is a full window of history', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(2),
                habitAgeDays: 10,
                completionsShortWindow: 1,
            }));

            expect(decision.nextPhase).to.equal('established');
        });

        it('rate-limits repeat comeback offers to once a month', () => {
            const tooSoon = evaluateHabitPhase(baseInput({
                phase: 'lapsed',
                establishedAt: daysBefore(90),
                lastComebackAt: daysBefore(COMEBACK_MIN_INTERVAL_DAYS - 1),
                habitAgeDays: 120,
                completionsShortWindow: 1,
            }));
            expect(tooSoon.comebackDue).to.equal(false);

            const dueAgain = evaluateHabitPhase(baseInput({
                phase: 'lapsed',
                establishedAt: daysBefore(90),
                lastComebackAt: daysBefore(COMEBACK_MIN_INTERVAL_DAYS),
                habitAgeDays: 120,
                completionsShortWindow: 1,
            }));
            expect(dueAgain.comebackDue).to.equal(true);
        });

        it('returns a recovering habit to forming so it gets daily support again', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'lapsed',
                establishedAt: daysBefore(90),
                habitAgeDays: 120,
                completionsShortWindow: 8, // back over 50%
            }));

            expect(decision.nextPhase).to.equal('forming');
            expect(decision.comebackDue).to.equal(false);
            expect(decision.allowsDailyNudge).to.equal(true);
        });

        it('leaves hysteresis between the lapse and establish bars', () => {
            // A habit sitting between the two thresholds must not oscillate
            // between "congratulations" and "want to restart?" week over week.
            const between = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(40),
                habitAgeDays: 61,
                completionsShortWindow: 10, // 71% — under establish, over lapse
            }));

            expect(between.nextPhase).to.equal('established');
            expect(between.comebackDue).to.equal(false);
        });
    });

    describe('single-run coherence', () => {
        it('does not nudge on the run it celebrates the taper', () => {
            // The milestone copy promises we are easing off; pairing it with the
            // very reminder it disowns reads as a broken promise.
            const decision = evaluateHabitPhase(baseInput({
                habitAgeDays: ESTABLISH_DAY_FLOOR,
                completionsShortWindow: 13,
            }));

            expect(decision.milestone).to.equal('established');
            expect(decision.allowsDailyNudge).to.equal(false);
        });

        it('does not nudge on the run it offers a comeback', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(40),
                habitAgeDays: 61,
                completionsShortWindow: 5,
            }));

            expect(decision.comebackDue).to.equal(true);
            expect(decision.allowsDailyNudge).to.equal(false);
        });

        it('never asks "still going?" and "want to restart?" in the same run', () => {
            const decision = evaluateHabitPhase(baseInput({
                phase: 'established',
                establishedAt: daysBefore(30),
                maintenanceStage: 0,
                habitAgeDays: 51,
                completionsShortWindow: 2, // lapsing on the very run a stage is due
            }));

            expect(decision.nextPhase).to.equal('lapsed');
            expect(decision.comebackDue).to.equal(true);
            expect(decision.maintenanceDue).to.equal(undefined);
        });

        it('reports consistency as a whole percent for copy interpolation', () => {
            const decision = evaluateHabitPhase(baseInput({
                habitAgeDays: 30,
                completionsShortWindow: 7,
            }));

            expect(decision.consistencyPercent).to.equal(50);
        });
    });
});
