/**
 * Phase 1 of the abstractable content algorithms (docs/ALGORITHM_AUDIT.md follow-on).
 *
 * Two properties in here are load-bearing and should not be relaxed:
 *
 *  1. PULSE emits the legacy HOT_SCORE_EXPRESSION byte for byte. That is what makes shipping
 *     the picker behavior-preserving for every user who never touches it.
 *  2. Every profile's SQL clamps the age at zero. An unclamped negative base in POWER() is a
 *     hard Postgres error that froze the feed for 8 days; this module is now the only place
 *     that clamp lives, so it is asserted per profile rather than once.
 */
import { expect } from 'chai';
import {
    CONTENT_ALGORITHM_VALUES,
    ContentAlgorithms,
    DEFAULT_CONTENT_ALGORITHM,
    applyAuthorDiversity,
    getAlgorithmProfile,
    getAllAlgorithmProfiles,
    getGeoTerm,
    getHotnessTerm,
    getScoreSqlExpression,
    isContentAlgorithm,
    normalizeContentAlgorithm,
    numberFromEnv,
    rankByScore,
    scoreContent,
} from '../src/content-ranking';

/**
 * The exact expression that shipped in users-service ThoughtsStore before this abstraction.
 * Copied verbatim, not imported, so a change on either side shows up as a test failure
 * instead of both moving together.
 */
const LEGACY_HOT_SCORE_EXPRESSION = '("replyCount" + 1) / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600, 0) + 2, 1.5)';

const THOUGHT_COLUMNS = {
    engagementCount: '"replyCount"',
    createdAt: '"createdAt"',
};

const withEnv = (vars: { [key: string]: string | undefined }, run: () => void) => {
    const previous: { [key: string]: string | undefined } = {};
    Object.keys(vars).forEach((key) => {
        previous[key] = process.env[key];
        if (vars[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = vars[key];
        }
    });
    try {
        run();
    } finally {
        Object.keys(previous).forEach((key) => {
            if (previous[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = previous[key] as string;
            }
        });
    }
};

describe('content-ranking', () => {
    describe('algorithm identity', () => {
        it('exposes exactly the three user-facing algorithms', () => {
            expect(CONTENT_ALGORITHM_VALUES).to.have.members([
                ContentAlgorithms.WANDER,
                ContentAlgorithms.FOCUS,
                ContentAlgorithms.PULSE,
            ]);
            expect(CONTENT_ALGORITHM_VALUES).to.have.lengthOf(3);
        });

        it('defaults to PULSE so the rollout is behavior-preserving', () => {
            expect(DEFAULT_CONTENT_ALGORITHM).to.equal(ContentAlgorithms.PULSE);
        });

        it('coerces unknown, null, and non-string values to the default rather than throwing', () => {
            expect(normalizeContentAlgorithm('nonsense')).to.equal(DEFAULT_CONTENT_ALGORITHM);
            expect(normalizeContentAlgorithm(undefined)).to.equal(DEFAULT_CONTENT_ALGORITHM);
            expect(normalizeContentAlgorithm(null)).to.equal(DEFAULT_CONTENT_ALGORITHM);
            expect(normalizeContentAlgorithm(42)).to.equal(DEFAULT_CONTENT_ALGORITHM);
            expect(normalizeContentAlgorithm(ContentAlgorithms.WANDER)).to.equal(ContentAlgorithms.WANDER);
        });

        it('type-guards real values only', () => {
            expect(isContentAlgorithm('wander')).to.equal(true);
            expect(isContentAlgorithm('Wander')).to.equal(false);
            expect(isContentAlgorithm(undefined)).to.equal(false);
        });
    });

    describe('SQL emission — legacy parity', () => {
        it('emits the legacy hot score byte for byte under PULSE', () => {
            const profile = getAlgorithmProfile(ContentAlgorithms.PULSE);
            expect(getScoreSqlExpression(profile, THOUGHT_COLUMNS)).to.equal(LEGACY_HOT_SCORE_EXPRESSION);
        });

        it('omits interest and geo terms entirely when their weights are zero', () => {
            const sql = getScoreSqlExpression(getAlgorithmProfile(ContentAlgorithms.PULSE), {
                ...THOUGHT_COLUMNS,
                interestOverlap: '"scoreInterest"',
                distanceMeters: 'ST_Distance(a, b)',
            });
            // Supplying the columns must not change PULSE's ordering — a zero weight means the
            // term does not exist, not that it is multiplied by zero.
            expect(sql).to.equal(LEGACY_HOT_SCORE_EXPRESSION);
        });

        it('returns the identical string on repeated calls, so SELECT and ORDER BY cannot drift', () => {
            const profile = getAlgorithmProfile(ContentAlgorithms.WANDER);
            const columns = { ...THOUGHT_COLUMNS, distanceMeters: 'ST_Distance(a, b)' };
            expect(getScoreSqlExpression(profile, columns)).to.equal(getScoreSqlExpression(profile, columns));
        });
    });

    describe('SQL emission — the POWER clamp (8-day feed outage regression)', () => {
        getAllAlgorithmProfiles().forEach((profile) => {
            it(`clamps age at zero for ${profile.key}`, () => {
                const sql = getScoreSqlExpression(profile, {
                    ...THOUGHT_COLUMNS,
                    interestOverlap: '"scoreInterest"',
                    distanceMeters: 'ST_Distance(a, b)',
                });

                expect(sql).to.contain('POWER(GREATEST(');
                // The pre-incident form. A negative base here is a hard Postgres ERROR, not a
                // NULL, and aborts the whole candidate query.
                expect(sql).to.not.contain('POWER((EXTRACT');
                expect(sql).to.not.contain('NaN');
                expect(sql).to.not.contain('Infinity');
                expect(sql).to.not.contain('undefined');
            });
        });

        it('clamps distance at zero as well, so a negative distance cannot invert proximity', () => {
            const sql = getScoreSqlExpression(getAlgorithmProfile(ContentAlgorithms.WANDER), {
                ...THOUGHT_COLUMNS,
                distanceMeters: 'ST_Distance(a, b)',
            });
            expect(sql).to.contain('EXP(-1 * GREATEST(ST_Distance(a, b), 0)');
        });
    });

    describe('SQL emission — structure', () => {
        it('includes the interest term when FOCUS is given an overlap column', () => {
            const sql = getScoreSqlExpression(getAlgorithmProfile(ContentAlgorithms.FOCUS), {
                ...THOUGHT_COLUMNS,
                interestOverlap: '"scoreInterest"',
            });
            expect(sql).to.contain('COALESCE("scoreInterest", 0)');
        });

        it('omits the geo term when the surface supplies no distance (main.thoughts has no coordinates)', () => {
            const sql = getScoreSqlExpression(getAlgorithmProfile(ContentAlgorithms.WANDER), THOUGHT_COLUMNS);
            expect(sql).to.not.contain('EXP(');
        });

        it('applies the interest-match boost only when given a predicate', () => {
            const profile = getAlgorithmProfile(ContentAlgorithms.FOCUS);
            const withoutPredicate = getScoreSqlExpression(profile, THOUGHT_COLUMNS);
            const withPredicate = getScoreSqlExpression(profile, { ...THOUGHT_COLUMNS, isInterestMatch: '"isMatch"' });

            expect(withoutPredicate).to.not.contain('CASE WHEN');
            expect(withPredicate).to.contain('CASE WHEN "isMatch" THEN 1.5 ELSE 1 END');
        });

        it('emits a valid constant rather than empty SQL when every weight is zeroed out', () => {
            withEnv({ ALGO_PULSE_WEIGHT_HOTNESS: '0' }, () => {
                const sql = getScoreSqlExpression(getAlgorithmProfile(ContentAlgorithms.PULSE), THOUGHT_COLUMNS);
                expect(sql).to.equal('0');
            });
        });

        it('throws with an actionable message rather than emitting NaN into SQL', () => {
            const profile = getAlgorithmProfile(ContentAlgorithms.PULSE);
            const broken = { ...profile, recencyGravity: Number.NaN };
            expect(() => getScoreSqlExpression(broken, THOUGHT_COLUMNS)).to.throw(/recencyGravity/);
        });
    });

    describe('env overrides', () => {
        it('treats 0 as a real value instead of falling back to the default', () => {
            // The whole reason this parses rather than using `||`: 0 is how an operator turns a
            // term off without a deploy.
            withEnv({ TEST_ALGO_VALUE: '0' }, () => {
                expect(numberFromEnv('TEST_ALGO_VALUE', 5)).to.equal(0);
            });
        });

        it('falls back for absent, empty, and non-numeric values', () => {
            withEnv({ TEST_ALGO_VALUE: undefined }, () => {
                expect(numberFromEnv('TEST_ALGO_VALUE', 5)).to.equal(5);
            });
            withEnv({ TEST_ALGO_VALUE: '' }, () => {
                expect(numberFromEnv('TEST_ALGO_VALUE', 5)).to.equal(5);
            });
            withEnv({ TEST_ALGO_VALUE: 'abc' }, () => {
                expect(numberFromEnv('TEST_ALGO_VALUE', 5)).to.equal(5);
            });
        });

        it('retunes a profile without a deploy, and the change reaches the emitted SQL', () => {
            withEnv({ ALGO_PULSE_GRAVITY: '0.9' }, () => {
                const profile = getAlgorithmProfile(ContentAlgorithms.PULSE);
                expect(profile.recencyGravity).to.equal(0.9);
                expect(getScoreSqlExpression(profile, THOUGHT_COLUMNS)).to.contain(', 0.9)');
            });
            // and reverts cleanly
            expect(getAlgorithmProfile(ContentAlgorithms.PULSE).recencyGravity).to.equal(1.5);
        });

        it('CONTENT_ALGORITHM_OVERRIDE forces every user onto one profile', () => {
            withEnv({ CONTENT_ALGORITHM_OVERRIDE: ContentAlgorithms.FOCUS }, () => {
                expect(getAlgorithmProfile(ContentAlgorithms.WANDER).key).to.equal(ContentAlgorithms.FOCUS);
            });
        });

        it('ignores a CONTENT_ALGORITHM_OVERRIDE that names nothing real', () => {
            withEnv({ CONTENT_ALGORITHM_OVERRIDE: 'typo' }, () => {
                expect(getAlgorithmProfile(ContentAlgorithms.WANDER).key).to.equal(ContentAlgorithms.WANDER);
            });
        });
    });

    describe('scoreContent', () => {
        const pulse = getAlgorithmProfile(ContentAlgorithms.PULSE);
        const wander = getAlgorithmProfile(ContentAlgorithms.WANDER);
        const focus = getAlgorithmProfile(ContentAlgorithms.FOCUS);

        it('matches the legacy formula exactly under PULSE', () => {
            const expected = (12 + 1) / ((5 + 2) ** 1.5);
            expect(scoreContent({ ageHours: 5, engagementCount: 12 }, pulse)).to.be.closeTo(expected, 1e-12);
        });

        it('clamps future-dated content instead of producing NaN', () => {
            // therr-ai-automator post-dates thoughts by up to ~30h; this is routine, not an edge case.
            const future = scoreContent({ ageHours: -30, engagementCount: 3 }, pulse);
            const brandNew = scoreContent({ ageHours: 0, engagementCount: 3 }, pulse);
            expect(Number.isFinite(future)).to.equal(true);
            expect(future).to.equal(brandNew);
        });

        it('ranks fresher content above older content with equal engagement', () => {
            expect(scoreContent({ ageHours: 1, engagementCount: 5 }, pulse))
                .to.be.greaterThan(scoreContent({ ageHours: 48, engagementCount: 5 }, pulse));
        });

        it('lets engagement dominate under PULSE but barely register under WANDER', () => {
            const quiet = { ageHours: 3, engagementCount: 0, distanceMeters: 100 };
            const viral = { ageHours: 3, engagementCount: 500, distanceMeters: 100 };

            const pulseLift = scoreContent(viral, pulse) / scoreContent(quiet, pulse);
            const wanderLift = scoreContent(viral, wander) / scoreContent(quiet, wander);

            // 500 replies is a ~500x lift under PULSE and single digits under WANDER — the
            // point is the ratio between them, not either absolute number.
            expect(pulseLift).to.be.greaterThan(50);
            expect(wanderLift).to.be.lessThan(pulseLift / 20);
        });

        it('ranks nearby above distant under WANDER, and ignores distance under PULSE', () => {
            const near = { ageHours: 10, engagementCount: 1, distanceMeters: 50 };
            const far = { ageHours: 10, engagementCount: 1, distanceMeters: 5000 };

            expect(scoreContent(near, wander)).to.be.greaterThan(scoreContent(far, wander));
            expect(scoreContent(near, pulse)).to.equal(scoreContent(far, pulse));
        });

        it('lets interest overlap outweigh hotness under FOCUS', () => {
            const onTopic = { ageHours: 40, engagementCount: 1, interestOverlap: 3 };
            const offTopic = { ageHours: 1, engagementCount: 8, interestOverlap: 0 };

            expect(scoreContent(onTopic, focus)).to.be.greaterThan(scoreContent(offTopic, focus));
            // ...but not under PULSE, which has no interest term at all.
            expect(scoreContent(onTopic, pulse)).to.be.lessThan(scoreContent(offTopic, pulse));
        });

        it('applies the interest-match boost multiplicatively to the whole blend', () => {
            const base = { ageHours: 4, engagementCount: 2 };
            const boosted = scoreContent({ ...base, isInterestMatch: true }, pulse);
            expect(boosted).to.be.closeTo(scoreContent(base, pulse) * pulse.interestMatchBoost, 1e-12);
        });

        it('treats missing, null, and negative components as zero rather than NaN', () => {
            [
                {},
                { ageHours: null, engagementCount: null, interestOverlap: null },
                { ageHours: -5, engagementCount: -5, interestOverlap: -5 },
            ].forEach((components) => {
                CONTENT_ALGORITHM_VALUES.forEach((key) => {
                    const score = scoreContent(components, getAlgorithmProfile(key));
                    expect(Number.isFinite(score), `${key} produced ${score}`).to.equal(true);
                });
            });
        });
    });

    describe('getGeoTerm', () => {
        const wander = getAlgorithmProfile(ContentAlgorithms.WANDER);

        it('contributes nothing when the surface has no coordinates', () => {
            expect(getGeoTerm({}, wander)).to.equal(0);
            expect(getGeoTerm({ distanceMeters: null }, wander)).to.equal(0);
        });

        it('decays to 1/e at the profile geo scale', () => {
            expect(getGeoTerm({ distanceMeters: 0 }, wander)).to.equal(1);
            expect(getGeoTerm({ distanceMeters: wander.geoScaleMeters }, wander)).to.be.closeTo(1 / Math.E, 1e-12);
        });
    });

    describe('getHotnessTerm', () => {
        it('never divides by zero even if the offset is tuned to zero', () => {
            withEnv({ ALGO_PULSE_RECENCY_OFFSET_HOURS: '0' }, () => {
                const profile = getAlgorithmProfile(ContentAlgorithms.PULSE);
                const score = getHotnessTerm({ ageHours: 0, engagementCount: 1 }, profile);
                expect(Number.isFinite(score)).to.equal(true);
            });
        });
    });

    describe('applyAuthorDiversity', () => {
        const items = [
            { id: 'a1', fromUserId: 'a' },
            { id: 'a2', fromUserId: 'a' },
            { id: 'a3', fromUserId: 'a' },
            { id: 'b1', fromUserId: 'b' },
            { id: 'c1', fromUserId: 'c' },
        ];

        it('caps items per author and preserves relative order among the kept items', () => {
            expect(applyAuthorDiversity(items, 1).map((i) => i.id)).to.deep.equal(['a1', 'b1', 'c1', 'a2', 'a3']);
        });

        it('demotes rather than drops, so a page never silently shortens', () => {
            expect(applyAuthorDiversity(items, 2)).to.have.lengthOf(items.length);
        });

        it('is a no-op when uncapped, which is how PULSE reproduces production', () => {
            expect(applyAuthorDiversity(items, 0)).to.deep.equal(items);
            expect(getAlgorithmProfile(ContentAlgorithms.PULSE).maxPerAuthor).to.equal(0);
        });

        it('leaves items with no author alone', () => {
            const anonymous = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
            expect(applyAuthorDiversity(anonymous as any, 1)).to.deep.equal(anonymous);
        });
    });

    describe('rankByScore', () => {
        it('orders by score and keeps the supplied order for ties', () => {
            const posts = [
                { id: 'old', ageHours: 100, engagementCount: 1 },
                { id: 'tieA', ageHours: 5, engagementCount: 2 },
                { id: 'tieB', ageHours: 5, engagementCount: 2 },
                { id: 'hot', ageHours: 1, engagementCount: 30 },
            ];
            const ranked = rankByScore(posts, getAlgorithmProfile(ContentAlgorithms.PULSE), (p) => p);
            expect(ranked.map((p) => p.id)).to.deep.equal(['hot', 'tieA', 'tieB', 'old']);
        });

        it('returns the input untouched when empty', () => {
            expect(rankByScore([], getAlgorithmProfile(ContentAlgorithms.PULSE), () => ({}))).to.deep.equal([]);
        });
    });
});
