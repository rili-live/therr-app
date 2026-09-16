import { expect } from 'chai';
import sinon from 'sinon';
import SubscribersStore from '../../src/store/SubscribersStore';

const buildMockConnection = () => {
    const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    const writeStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    return {
        connection: {
            read: { query: readStub } as any,
            write: { query: writeStub } as any,
        },
        readStub,
        writeStub,
    };
};

describe('SubscribersStore', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('findSubscriber', () => {
        it('matches on the normalized email only', async () => {
            // The handler is handed the whole request body, which now carries
            // isSubscribedToIosWaitlist. Widening the WHERE to every key it happens to hold
            // would name a column per request and make an existing subscriber look new.
            const { connection, readStub } = buildMockConnection();
            const store = new SubscribersStore(connection);

            await store.findSubscriber({ email: 'Streak.Queen+fwh@gmail.com' } as any);

            const query = readStub.args[0][0];
            expect(query).to.contain('"email" = \'streakqueen@gmail.com\'');
            expect(query).to.not.contain('isSubscribedToIosWaitlist');
        });
    });

    describe('createSubscriber', () => {
        it('writes the brand and waitlist flag alongside the normalized email', async () => {
            const { connection, writeStub } = buildMockConnection();
            const store = new SubscribersStore(connection);

            await store.createSubscriber({
                email: 'StreakQueen@Example.com',
                brandVariation: 'habits',
                isSubscribedToIosWaitlist: true,
            });

            const query = writeStub.args[0][0];
            expect(query).to.contain('streakqueen@example.com');
            expect(query).to.contain('habits');
            expect(query).to.contain('true');
        });
    });

    describe('updateSubscriber', () => {
        it('stamps updatedAt as a UTC ISO-8601 literal', async () => {
            // knex's .toString() renders a JS Date in the Node process's local timezone with
            // no offset, which Postgres then reinterprets in the session timezone — the same
            // defect UsersStore.lastLoginAt was fixed for.
            const { connection, writeStub } = buildMockConnection();
            const store = new SubscribersStore(connection);

            await store.updateSubscriber(
                { isSubscribedToIosWaitlist: true },
                { email: 'streakqueen@example.com' },
            );

            const query = writeStub.args[0][0];
            expect(query).to.match(/"updatedAt" = '\d{4}-\d{2}-\d{2}T[\d:.]+Z'/);
        });

        it('scopes the update to the normalized email', async () => {
            const { connection, writeStub } = buildMockConnection();
            const store = new SubscribersStore(connection);

            await store.updateSubscriber(
                { isSubscribedToIosWaitlist: true },
                { email: 'Streak.Queen+fwh@gmail.com' },
            );

            expect(writeStub.args[0][0]).to.contain('where "email" = \'streakqueen@gmail.com\'');
        });
    });
});
