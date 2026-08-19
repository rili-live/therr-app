import { expect } from 'chai';
import {
    getInterestRanking,
    getShadowInterestWeight,
    compareInterestRankings,
    logShadowInterestRanking,
} from '../../src/utilities/interestWeights';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 27);

describe('interestWeights', () => {
    describe('getInterestRanking (live formula)', () => {
        // Pinning the documented defects so the shadow comparison has a known baseline and
        // so a later change to this formula is a deliberate act, not a silent drift.
        it('collapses low engagement into a single tied bucket', () => {
            // score is 5 for every row in production — no client has ever sent another value
            expect(getInterestRanking(1, 5)).to.eq(1);
            expect(getInterestRanking(5, 5)).to.eq(1);
            // ...so an interest engaged 5x ranks identically to one engaged once
            expect(getInterestRanking(0, 5)).to.eq(1);
        });

        it('treats a stronger declared preference as weaker', () => {
            // score 1 is documented as "the highest" preference, yet dividing by it produces
            // a LARGER ranking than score 5 for the same engagement — the live formula only
            // survives because score is a constant today.
            expect(getInterestRanking(10, 1)).to.eq(10);
            expect(getInterestRanking(10, 5)).to.eq(2);
        });
    });

    describe('getShadowInterestWeight', () => {
        it('re-applies decay at read time for a row not written in a while', () => {
            // The stored score was decayed to whenever the row was last written, so a row
            // untouched for a half-life must read at half its stored value.
            const fresh = getShadowInterestWeight({
                interestId: 'a', score: 5, affinityScore: 40, lastEngagedAt: new Date(NOW),
            }, NOW);
            const stale = getShadowInterestWeight({
                interestId: 'a', score: 5, affinityScore: 40, lastEngagedAt: new Date(NOW - (45 * DAY_MS)),
            }, NOW);

            expect(stale).to.be.lessThan(fresh);
            // 40 -> 20 after one half-life, through log1p and the 0.2 declared weight
            expect(stale).to.be.closeTo(0.2 * (1 + Math.log1p(20)), 1e-6);
        });

        it('keeps resolution instead of quantizing into tied buckets', () => {
            const a = getShadowInterestWeight({
                interestId: 'a', score: 5, affinityScore: 2, lastEngagedAt: new Date(NOW),
            }, NOW);
            const b = getShadowInterestWeight({
                interestId: 'b', score: 5, affinityScore: 4, lastEngagedAt: new Date(NOW),
            }, NOW);

            // Both are ranking 1 under the live formula; the shadow weight separates them.
            expect(getInterestRanking(2, 5)).to.eq(getInterestRanking(4, 5));
            expect(b).to.be.greaterThan(a);
        });

        it('makes a stronger declared preference rank higher, not lower', () => {
            const strongest = getShadowInterestWeight({
                interestId: 'a', score: 1, affinityScore: 10, lastEngagedAt: new Date(NOW),
            }, NOW);
            const weakest = getShadowInterestWeight({
                interestId: 'b', score: 5, affinityScore: 10, lastEngagedAt: new Date(NOW),
            }, NOW);

            expect(strongest).to.be.greaterThan(weakest);
        });

        it('damps a weight that has drawn negative signals', () => {
            const clean = getShadowInterestWeight({
                interestId: 'a', score: 5, affinityScore: 10, negativeCount: 0, lastEngagedAt: new Date(NOW),
            }, NOW);
            const damped = getShadowInterestWeight({
                interestId: 'a', score: 5, affinityScore: 10, negativeCount: 4, lastEngagedAt: new Date(NOW),
            }, NOW);

            expect(damped).to.be.lessThan(clean);
        });

        it('handles never-engaged and malformed rows without producing NaN', () => {
            const rows = [
                { interestId: 'a' },
                { interestId: 'b', affinityScore: undefined, lastEngagedAt: null },
                {
                    interestId: 'c', affinityScore: -5, score: 0, lastEngagedAt: 'not-a-date',
                },
                {
                    interestId: 'd', score: 99, affinityScore: 3, lastEngagedAt: new Date(NOW),
                },
            ];

            rows.forEach((row) => {
                const weight = getShadowInterestWeight(row as any, NOW);
                expect(Number.isFinite(weight), `row ${row.interestId}`).to.be.eq(true);
                expect(weight).to.be.at.least(0);
            });
        });
    });

    describe('compareInterestRankings', () => {
        it('reports no displacement when both formulas agree', () => {
            const rows = [
                {
                    interestId: 'a', score: 5, engagementCount: 50, affinityScore: 50, lastEngagedAt: new Date(NOW),
                },
                {
                    interestId: 'b', score: 5, engagementCount: 20, affinityScore: 20, lastEngagedAt: new Date(NOW),
                },
                {
                    interestId: 'c', score: 5, engagementCount: 5, affinityScore: 5, lastEngagedAt: new Date(NOW),
                },
            ];

            const result = compareInterestRankings(rows, NOW);

            expect(result?.footruleNormalized).to.eq(0);
            expect(result?.topOverlap).to.eq(1);
        });

        it('registers displacement when decay demotes a stale but heavily-engaged interest', () => {
            const rows = [
                // Big lifetime count, untouched for a year — the case decay exists for
                {
                    interestId: 'stale', score: 5, engagementCount: 200, affinityScore: 200, lastEngagedAt: new Date(NOW - (365 * DAY_MS)),
                },
                {
                    interestId: 'fresh', score: 5, engagementCount: 12, affinityScore: 12, lastEngagedAt: new Date(NOW),
                },
            ];

            const result = compareInterestRankings(rows, NOW);

            expect(result?.footruleNormalized).to.be.greaterThan(0);
            // Live ranks purely on the raw count, shadow demotes the year-old interest
            expect(getInterestRanking(200, 5)).to.be.greaterThan(getInterestRanking(12, 5));
            expect(getShadowInterestWeight(rows[1], NOW)).to.be.greaterThan(getShadowInterestWeight(rows[0], NOW));
        });

        it('returns null when there is nothing meaningful to compare', () => {
            expect(compareInterestRankings([], NOW)).to.eq(null);
            expect(compareInterestRankings([{ interestId: 'a' }], NOW)).to.eq(null);
            expect(compareInterestRankings(undefined as any, NOW)).to.eq(null);
        });
    });

    describe('logShadowInterestRanking', () => {
        // It hangs off a live request path, so it must be incapable of failing that request.
        it('never throws, whatever it is handed', () => {
            expect(() => logShadowInterestRanking('user-1', null as any)).to.not.throw();
            expect(() => logShadowInterestRanking('user-1', [{ interestId: 'a' }, { interestId: 'b' }])).to.not.throw();
            expect(() => logShadowInterestRanking(undefined as any, [null, undefined] as any)).to.not.throw();
        });

        // The sample rate is read once at module load, so exercising it means reloading the
        // module under a different env. Swapping the log module in require.cache first is
        // what makes "did it log?" observable at all.
        const loadWithSampleRate = (rate: string | undefined) => {
            const weightsPath = require.resolve('../../src/utilities/interestWeights');
            const logSpanPath = require.resolve('therr-js-utilities/log-or-update-span');
            const previousRate = process.env.INTEREST_SHADOW_LOG_SAMPLE_RATE;
            const originalLogModule = require.cache[logSpanPath];
            const calls: any[] = [];

            if (rate === undefined) {
                delete process.env.INTEREST_SHADOW_LOG_SAMPLE_RATE;
            } else {
                process.env.INTEREST_SHADOW_LOG_SAMPLE_RATE = rate;
            }

            delete require.cache[weightsPath];
            require.cache[logSpanPath] = {
                ...(originalLogModule as any),
                exports: Object.assign((...args: any[]) => { calls.push(args); }, { default: (...args: any[]) => { calls.push(args); } }),
            } as any;

            // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
            const reloaded = require(weightsPath);

            const restore = () => {
                if (originalLogModule) {
                    require.cache[logSpanPath] = originalLogModule;
                } else {
                    delete require.cache[logSpanPath];
                }
                delete require.cache[weightsPath];
                if (previousRate === undefined) {
                    delete process.env.INTEREST_SHADOW_LOG_SAMPLE_RATE;
                } else {
                    process.env.INTEREST_SHADOW_LOG_SAMPLE_RATE = previousRate;
                }
            };

            return { reloaded, calls, restore };
        };

        const twoRows = [
            {
                interestId: 'a', score: 5, engagementCount: 50, affinityScore: 50, lastEngagedAt: new Date(NOW),
            },
            {
                interestId: 'b', score: 5, engagementCount: 2, affinityScore: 2, lastEngagedAt: new Date(NOW - (200 * DAY_MS)),
            },
        ];

        it('logs when the sample roll falls under the configured rate', () => {
            const { reloaded, calls, restore } = loadWithSampleRate('1');
            try {
                reloaded.logShadowInterestRanking('user-1', twoRows);
                expect(calls.length).to.eq(1);
            } finally {
                restore();
            }
        });

        // `Number(x) || 0.02` would silently restore the 2% default here, so an operator
        // turning shadow logging off in production would keep paying for 2% of it.
        it('logs nothing when the sample rate is explicitly set to zero', () => {
            const { reloaded, calls, restore } = loadWithSampleRate('0');
            try {
                for (let i = 0; i < 200; i += 1) {
                    reloaded.logShadowInterestRanking('user-1', twoRows);
                }
                expect(calls.length).to.eq(0);
            } finally {
                restore();
            }
        });

        it('falls back to the 2% default when the rate is unset or unparseable', () => {
            const unset = loadWithSampleRate(undefined);
            try {
                expect(unset.reloaded.logShadowInterestRanking('user-1', twoRows)).to.eq(undefined);
            } finally {
                unset.restore();
            }

            const garbage = loadWithSampleRate('not-a-number');
            try {
                // 200 rolls against a 2% rate essentially never yields zero logs; a NaN rate
                // would make `Math.random() >= NaN` false and log every single time.
                for (let i = 0; i < 200; i += 1) {
                    garbage.reloaded.logShadowInterestRanking('user-1', twoRows);
                }
                expect(garbage.calls.length).to.be.lessThan(200);
            } finally {
                garbage.restore();
            }
        });
    });
});
