import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { updateUserHabitNotificationPreferences } from '../../src/handlers/userHabits';
import {
    createHabitNotificationPreferenceResolver,
    preferenceCacheKey,
} from '../../src/utilities/habitNotificationPreferences';

/**
 * Per-habit notification switches (`habits.user_habits.notify*`).
 *
 * Two properties carry the whole feature and neither is visible from a happy-path
 * read:
 *
 *   1. **It fails open.** A pair with no tracking row, or a read that throws,
 *      resolves to everything-on. Failing closed would turn a database hiccup
 *      into silence, which is the failure nobody reports because it looks
 *      exactly like having nothing to say.
 *   2. **It costs one read.** The digest walks up to 500 pacts and 2000 habits;
 *      a lookup per notification against the same rows is the difference
 *      between a background job and an outage. The resolver is seeded from rows
 *      the caller already has and batches the rest.
 */
describe('per-habit notification preferences', () => {
    const USER = 'user-1';
    const GOAL = 'goal-1';

    afterEach(() => {
        sinon.restore();
    });

    describe('the resolver', () => {
        it('answers from a seed row without touching the database', async () => {
            const fetchStub = sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs').resolves({});
            const resolver = createHabitNotificationPreferenceResolver([
                {
                    userId: USER,
                    habitGoalId: GOAL,
                    notifyReminders: true,
                    notifyStreakAlerts: false,
                    notifyPartnerActivity: false,
                    notifyPactUpdates: true,
                },
            ]);

            const prefs = await resolver.get(USER, GOAL);

            expect(prefs.notifyReminders).to.equal(true);
            expect(prefs.notifyStreakAlerts).to.equal(false);
            expect(prefs.notifyPartnerActivity).to.equal(false);
            expect(fetchStub.called).to.equal(false);
        });

        it('treats a seed row missing the columns as opted in', async () => {
            // A query written before the columns existed returns rows without
            // them. That must read as "everything on", not as a silent mute.
            sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs').resolves({});
            const resolver = createHabitNotificationPreferenceResolver([
                { userId: USER, habitGoalId: GOAL } as any,
            ]);

            const prefs = await resolver.get(USER, GOAL);

            expect(prefs).to.deep.equal({
                notifyReminders: true,
                notifyStreakAlerts: true,
                notifyPartnerActivity: true,
                notifyPactUpdates: true,
            });
        });

        it('reads an unseeded pair once and caches both hits and misses', async () => {
            const fetchStub = sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs')
                .resolves({
                    [preferenceCacheKey(USER, GOAL)]: {
                        notifyReminders: false,
                        notifyStreakAlerts: true,
                        notifyPartnerActivity: true,
                        notifyPactUpdates: true,
                    },
                });
            const resolver = createHabitNotificationPreferenceResolver();

            expect((await resolver.get(USER, GOAL)).notifyReminders).to.equal(false);
            // A pair with no row at all must not be re-queried for the rest of
            // the run either.
            expect((await resolver.get('user-2', GOAL)).notifyReminders).to.equal(true);
            await resolver.get(USER, GOAL);
            await resolver.get('user-2', GOAL);

            expect(fetchStub.callCount).to.equal(2);
        });

        it('batches a prime into one read and never re-asks for a seeded pair', async () => {
            const fetchStub = sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs').resolves({});
            const resolver = createHabitNotificationPreferenceResolver([
                { userId: USER, habitGoalId: GOAL, notifyPartnerActivity: false },
            ]);

            await resolver.prime([
                { userId: USER, habitGoalId: GOAL },
                { userId: 'user-2', habitGoalId: GOAL },
                { userId: 'user-3', habitGoalId: GOAL },
            ]);

            expect(fetchStub.callCount).to.equal(1);
            // Only the two it did not already hold.
            expect(fetchStub.firstCall.args[0]).to.have.length(2);
            expect((await resolver.get(USER, GOAL)).notifyPartnerActivity).to.equal(false);
        });

        it('peeks the cache synchronously after a prime, and fails open on a pair never primed', async () => {
            const fetchStub = sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs')
                .resolves({
                    [preferenceCacheKey(USER, GOAL)]: {
                        notifyReminders: true,
                        notifyStreakAlerts: true,
                        notifyPartnerActivity: false,
                        notifyPactUpdates: true,
                    },
                });
            const resolver = createHabitNotificationPreferenceResolver();

            // Nothing cached yet: defaults, and no read is spent finding that out.
            expect(resolver.peek(USER, GOAL).notifyPartnerActivity).to.equal(true);
            expect(fetchStub.callCount).to.equal(0);

            await resolver.prime([{ userId: USER, habitGoalId: GOAL }, { userId: 'user-2', habitGoalId: GOAL }]);

            expect(resolver.peek(USER, GOAL).notifyPartnerActivity).to.equal(false);
            // Primed but with no row — cached as the defaults, same as `get`.
            expect(resolver.peek('user-2', GOAL).notifyPartnerActivity).to.equal(true);
            expect(fetchStub.callCount).to.equal(1);
        });

        it('fails open when the read throws', async () => {
            sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs').rejects(new Error('pool exhausted'));
            const resolver = createHabitNotificationPreferenceResolver();

            const prefs = await resolver.get(USER, GOAL);

            expect(prefs).to.deep.equal({
                notifyReminders: true,
                notifyStreakAlerts: true,
                notifyPartnerActivity: true,
                notifyPactUpdates: true,
            });
        });

        it('does not let a later seed overwrite a value already read', async () => {
            sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs').resolves({
                [preferenceCacheKey(USER, GOAL)]: {
                    notifyReminders: false,
                    notifyStreakAlerts: false,
                    notifyPartnerActivity: false,
                    notifyPactUpdates: false,
                },
            });
            const resolver = createHabitNotificationPreferenceResolver();

            await resolver.get(USER, GOAL);
            resolver.seed([{ userId: USER, habitGoalId: GOAL }]);

            expect((await resolver.get(USER, GOAL)).notifyReminders).to.equal(false);
        });
    });

    describe('PUT /habits/user-habits/:id/notification-preferences', () => {
        const makeRes = () => {
            const res: any = {
                statusCode: undefined,
                body: undefined,
                status(code: number) {
                    res.statusCode = code;
                    return res;
                },
                send(payload: any) {
                    res.body = payload;
                    return res;
                },
            };
            return res;
        };

        const makeReq = (body: any, id = 'uh-1') => ({
            headers: {
                'x-userid': USER,
                'x-localecode': 'en-us',
                'x-brand-variation': BrandVariations.HABITS,
            },
            body,
            params: { id },
            query: {},
        });

        let getByIdStub: sinon.SinonStub;
        let updateStub: sinon.SinonStub;

        beforeEach(() => {
            getByIdStub = sinon.stub(Store.userHabits, 'getById').resolves({
                id: 'uh-1', userId: USER, habitGoalId: GOAL, status: 'active',
            } as any);
            updateStub = sinon.stub(Store.userHabits, 'updateNotificationPreferences')
                .resolves({ id: 'uh-1', userId: USER, notifyPartnerActivity: false } as any);
        });

        it('writes only the keys the body carried', async () => {
            const res = makeRes();
            await updateUserHabitNotificationPreferences(
                makeReq({ notifyPartnerActivity: false }) as any,
                res,
                (() => {}) as any,
            );

            expect(res.statusCode).to.equal(200);
            // A client that knows about one category must not reset the other
            // three just by not mentioning them.
            expect(updateStub.firstCall.args[2]).to.deep.equal({ notifyPartnerActivity: false });
        });

        it('ignores non-boolean values rather than coercing them', async () => {
            // `"false"` from a form-encoded client is the case that matters: it
            // is truthy, so coercing would turn "off" into "on".
            const res = makeRes();
            await updateUserHabitNotificationPreferences(
                makeReq({ notifyReminders: 'false', notifyStreakAlerts: false }) as any,
                res,
                (() => {}) as any,
            );

            expect(updateStub.firstCall.args[2]).to.deep.equal({ notifyStreakAlerts: false });
        });

        it('400s a body with none of the four keys', async () => {
            const res = makeRes();
            await updateUserHabitNotificationPreferences(
                makeReq({ notifyEverything: false }) as any,
                res,
                (() => {}) as any,
            );

            expect(res.statusCode).to.equal(400);
            expect(updateStub.called).to.equal(false);
        });

        it('404s a habit belonging to someone else', async () => {
            getByIdStub.resolves({
                id: 'uh-1', userId: 'someone-else', habitGoalId: GOAL, status: 'active',
            } as any);

            const res = makeRes();
            await updateUserHabitNotificationPreferences(
                makeReq({ notifyReminders: false }) as any,
                res,
                (() => {}) as any,
            );

            expect(res.statusCode).to.equal(404);
            expect(updateStub.called).to.equal(false);
        });
    });
});
