/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import PactsStore from '../../src/store/PactsStore';
import HabitCheckinsStore from '../../src/store/HabitCheckinsStore';
import { selectPactPartnerIds } from '../../src/utilities/pactHelpers';

/**
 * Check-in → pact resolution — regression tests.
 *
 * A check-in is logged against a habit goal, never a pact, so no client sends
 * a `pactId`. Everything behind `createCheckin`'s old `if (pactId)` guard was
 * therefore dead: `habit_checkins.pactId` was never written (leaving
 * GET /pacts/:pactId/checkins permanently empty), the partnerCheckedIn push
 * never fired, and mid-pact Wing Person credit never landed. The handler now
 * resolves the active pacts backing the goal instead.
 */

const buildStore = (StoreClass: any, rows: any[] = []) => {
    const mockConnection = {
        read: { query: sinon.stub().callsFake(() => Promise.resolve({ rows })) },
        write: { query: sinon.stub().callsFake(() => Promise.resolve({ rows })) },
    };

    return { store: new StoreClass(mockConnection as any), mockConnection };
};

describe('pact partner resolution', () => {
    describe('PactsStore.getActiveByUserAndHabitGoal', () => {
        it('scopes to active pacts on the habit goal the user is an active member of', async () => {
            const { store, mockConnection } = buildStore(PactsStore);

            await store.getActiveByUserAndHabitGoal('user-1', 'goal-1');

            expect(mockConnection.read.query.callCount).to.be.equal(1);
            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('"habits"."pacts"');
            expect(queryString).to.contain('"habits"."pact_members"');
            expect(queryString).to.contain(`"habitGoalId" = 'goal-1'`);
            expect(queryString).to.contain(`"habits"."pacts"."status" = 'active'`);
            expect(queryString).to.contain(`"habits"."pact_members"."status" = 'active'`);
        });

        // Gated on the member row being absent, not merely on membership failing to match.
        // `pacts.partnerUserId` outlives membership — declining an already-active 1:1 pact
        // marks the member `left` and leaves the column pointing at them — so an ungated
        // fallback keeps crediting a departed member's check-ins to the pact they left.
        // Behaviour is pinned end-to-end in tests/integration/pacts.integration.test.ts.
        it('falls back to the creator/partner columns only when the user has no member row', async () => {
            const { store, mockConnection } = buildStore(PactsStore);

            await store.getActiveByUserAndHabitGoal('user-1', 'goal-1');

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain(`"creatorUserId" = 'user-1'`);
            expect(queryString).to.contain(`"partnerUserId" = 'user-1'`);
            // The join is already scoped to this user, so a null member id means
            // "no row for them" rather than "the pact has no members".
            expect(queryString).to.contain('"habits"."pact_members"."id" is null');
            expect(queryString).to.match(
                /"habits"\."pact_members"\."id" is null and \("habits"\."pacts"\."creatorUserId"/,
            );
        });

        // habit_checkins.pactId is singular, so a goal backing two active pacts
        // needs a deterministic winner or the attribution flaps between requests.
        it('orders by startDate so single-pact attribution is deterministic', async () => {
            const { store, mockConnection } = buildStore(PactsStore);

            await store.getActiveByUserAndHabitGoal('user-1', 'goal-1');

            expect(mockConnection.read.query.args[0][0]).to.contain('order by "habits"."pacts"."startDate" asc');
        });
    });

    describe('HabitCheckinsStore.createOrUpdate', () => {
        it('backfills pactId on a re-submitted check-in that was written without one', async () => {
            const { store, mockConnection } = buildStore(HabitCheckinsStore);

            await store.createOrUpdate({
                userId: 'user-1',
                habitGoalId: 'goal-1',
                pactId: 'pact-1',
                scheduledDate: '2026-08-03',
                status: 'completed',
            });

            const queryString = mockConnection.write.query.args[0][0];
            expect(queryString).to.contain('on conflict');
            expect(queryString).to.contain(`"pactId" = 'pact-1'`);
        });

        it('leaves a genuinely pact-less check-in pact-less on conflict', async () => {
            const { store, mockConnection } = buildStore(HabitCheckinsStore);

            await store.createOrUpdate({
                userId: 'user-1',
                habitGoalId: 'goal-1',
                scheduledDate: '2026-08-03',
                status: 'completed',
            });

            const queryString = mockConnection.write.query.args[0][0];
            const doUpdateClause = queryString.split('do update set')[1];
            expect(doUpdateClause).to.not.contain('"pactId"');
        });
    });

    describe('selectPactPartnerIds', () => {
        const pact = (id: string, partnerUserId: string | null = null) => ({
            id,
            creatorUserId: 'user-1',
            partnerUserId,
        });

        it('returns the other active members of a pact', () => {
            const result = selectPactPartnerIds(
                [pact('pact-1')],
                {
                    'pact-1': [
                        { pactId: 'pact-1', userId: 'user-1', status: 'active' },
                        { pactId: 'pact-1', userId: 'user-2', status: 'active' },
                    ],
                },
                'user-1',
            );

            expect(result).to.deep.equal(['user-2']);
        });

        // getPartnerUserId only understands 1:1 pacts — a group pact leaves
        // partnerUserId null, which is why it returned nobody before.
        it('returns every other member of a group pact, not just one', () => {
            const result = selectPactPartnerIds(
                [pact('pact-1')],
                {
                    'pact-1': [
                        { pactId: 'pact-1', userId: 'user-1', status: 'active' },
                        { pactId: 'pact-1', userId: 'user-2', status: 'active' },
                        { pactId: 'pact-1', userId: 'user-3', status: 'active' },
                    ],
                },
                'user-1',
            );

            expect(result).to.have.members(['user-2', 'user-3']);
            expect(result).to.have.lengthOf(2);
        });

        it('skips members who have not accepted or have left', () => {
            const result = selectPactPartnerIds(
                [pact('pact-1')],
                {
                    'pact-1': [
                        { pactId: 'pact-1', userId: 'user-1', status: 'active' },
                        { pactId: 'pact-1', userId: 'user-2', status: 'pending' },
                        { pactId: 'pact-1', userId: 'user-3', status: 'left' },
                    ],
                },
                'user-1',
            );

            expect(result).to.deep.equal([]);
        });

        it('tells someone in two pacts on the same habit only once', () => {
            const result = selectPactPartnerIds(
                [pact('pact-1'), pact('pact-2')],
                {
                    'pact-1': [
                        { pactId: 'pact-1', userId: 'user-1', status: 'active' },
                        { pactId: 'pact-1', userId: 'user-2', status: 'active' },
                    ],
                    'pact-2': [
                        { pactId: 'pact-2', userId: 'user-1', status: 'active' },
                        { pactId: 'pact-2', userId: 'user-2', status: 'active' },
                    ],
                },
                'user-1',
            );

            expect(result).to.deep.equal(['user-2']);
        });

        it('falls back to the 1:1 columns when a pact has no member rows', () => {
            const result = selectPactPartnerIds([pact('pact-1', 'user-9')], {}, 'user-1');

            expect(result).to.deep.equal(['user-9']);
        });

        it('honors per-pact notification preferences when onlyCelebrating is set', () => {
            const membersByPactId = {
                'pact-1': [
                    { pactId: 'pact-1', userId: 'user-1', status: 'active' },
                    {
                        pactId: 'pact-1', userId: 'user-2', status: 'active', shouldMuteNotifs: true,
                    },
                    {
                        pactId: 'pact-1', userId: 'user-3', status: 'active', celebratePartnerCheckins: false,
                    },
                    {
                        pactId: 'pact-1', userId: 'user-4', status: 'active', celebratePartnerCheckins: true,
                    },
                ],
            };

            const forPush = selectPactPartnerIds([pact('pact-1')], membersByPactId, 'user-1', { onlyCelebrating: true });
            expect(forPush).to.deep.equal(['user-4']);

            // Silent side effects (achievement credit) still reach muted members.
            const forCredit = selectPactPartnerIds([pact('pact-1')], membersByPactId, 'user-1');
            expect(forCredit).to.have.members(['user-2', 'user-3', 'user-4']);
        });

        it('returns nothing for a solo habit with no pacts', () => {
            expect(selectPactPartnerIds([], {}, 'user-1')).to.deep.equal([]);
        });
    });
});
