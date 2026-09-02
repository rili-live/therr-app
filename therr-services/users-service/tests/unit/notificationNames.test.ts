import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import {
    createNameResolvers,
    resolveHabitDisplayName,
    resolveUserDisplayName,
} from '../../src/utilities/notificationNames';

/**
 * Habits push copy is name-anchored — "{partnerName} hit Day {streakCount} on
 * {habitName}" — and `translate` leaves any placeholder it was not given
 * standing verbatim. So a caller that cannot resolve a name does not render a
 * slightly generic notification; it renders braces.
 *
 * That shipped: `partnerCheckedIn` and `streakMilestone` were sent inline with
 * no names at all. These pin the fallbacks, and the single rule both the digest
 * and the inline check-in path now share — they disagreed before, so the same
 * partner was named two different ways depending on which notification arrived.
 */
describe('notification display names', () => {
    afterEach(() => sinon.restore());

    describe('resolveUserDisplayName', () => {
        it('prefers the first name', () => {
            sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Dana', userName: 'dana99' }] as any);

            return resolveUserDisplayName('user-1').then((name) => {
                // First name, not full name: this lands in a notification title
                // Android truncates at roughly 40 characters.
                expect(name).to.equal('Dana');
            });
        });

        it('falls back to the handle when there is no first name', () => {
            sinon.stub(Store.users, 'findUser').resolves([{ userName: 'dana99' }] as any);

            return resolveUserDisplayName('user-1').then((name) => expect(name).to.equal('dana99'));
        });

        it('never returns empty — an empty name renders a sentence with a hole in it', () => {
            sinon.stub(Store.users, 'findUser').resolves([] as any);

            return resolveUserDisplayName('user-1').then((name) => expect(name).to.equal('Your partner'));
        });

        it('survives a failed read rather than failing the check-in that triggered it', () => {
            sinon.stub(Store.users, 'findUser').rejects(new Error('read pool exhausted'));

            return resolveUserDisplayName('user-1').then((name) => expect(name).to.equal('Your partner'));
        });

        it('does not query for a missing id', async () => {
            const findUser = sinon.stub(Store.users, 'findUser').resolves([] as any);

            expect(await resolveUserDisplayName('')).to.equal('Your partner');
            expect(findUser.called).to.equal(false);
        });
    });

    describe('resolveHabitDisplayName', () => {
        it('uses the goal name and degrades to something grammatical', async () => {
            const getById = sinon.stub(Store.habitGoals, 'getById');
            getById.withArgs('goal-1').resolves({ name: 'Reading' } as any);
            getById.withArgs('goal-2').resolves(null as any);

            expect(await resolveHabitDisplayName('goal-1')).to.equal('Reading');
            expect(await resolveHabitDisplayName('goal-2')).to.equal('your habit');
        });
    });

    describe('createNameResolvers', () => {
        it('reads each name once per run', async () => {
            // The digest walks up to 500 pacts and 2000 habits and names the same
            // handful of people over and over.
            const findUser = sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Dana' }] as any);
            const { getUserDisplayName } = createNameResolvers();

            await getUserDisplayName('user-1');
            await getUserDisplayName('user-1');
            await getUserDisplayName('user-2');

            expect(findUser.callCount).to.equal(2);
        });
    });
});
