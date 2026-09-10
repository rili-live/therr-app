import { expect } from 'chai';
import sinon from 'sinon';
import SubscriptionPurchasesStore from '../../src/store/SubscriptionPurchasesStore';

/**
 * The "one Play token, one account" invariant.
 *
 * `upsertByPurchaseToken` writes `userId` as part of the updatable column set, so
 * an update against a token another account already owns silently re-points the
 * row and hands the second account the first account's paid subscription. The
 * UNIQUE(purchaseToken) index does not stop that — it only stops a second INSERT,
 * and this path writes *through* the existing row rather than past it.
 *
 * The handler checks ownership too, but its read is outside this transaction, so
 * two concurrent verifies of the same stolen token can both see "unclaimed". This
 * is the check that has to hold.
 */
const makeFakeClient = (existingRow: any) => {
    const queries: string[] = [];
    const client = {
        queries,
        released: false,
        query: (sql: string) => {
            queries.push(sql);

            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
                return Promise.resolve({ rows: [] });
            }
            if (sql.trim().toLowerCase().startsWith('select')) {
                return Promise.resolve({ rows: existingRow ? [existingRow] : [] });
            }

            return Promise.resolve({ rows: [{ id: 'sub-1', userId: 'user-1' }] });
        },
        release: () => {
            client.released = true;
        },
    };
    return client;
};

const makeStore = (existingRow: any) => {
    const client = makeFakeClient(existingRow);
    const store = new SubscriptionPurchasesStore({
        read: { query: sinon.stub().resolves({ rows: [] }) },
        write: {
            query: sinon.stub().resolves({ rows: [] }),
            connect: () => Promise.resolve(client),
        },
    } as any);

    return { store, client };
};

const params = (overrides: any = {}) => ({
    userId: 'user-1',
    platform: 'android',
    productId: 'habits_premium_monthly',
    purchaseToken: 'sub-token-abc',
    status: 'active' as const,
    ...overrides,
});

describe('SubscriptionPurchasesStore.upsertByPurchaseToken', () => {
    it('updates in place when the same account re-verifies its own token', async () => {
        const { store } = makeStore({ id: 'sub-1', userId: 'user-1' });

        const result = await store.upsertByPurchaseToken(params());

        expect(result.wasAlreadyRecorded).to.equal(true);
    });

    it('inserts a new row for a token nothing has recorded yet', async () => {
        const { store } = makeStore(null);

        const result = await store.upsertByPurchaseToken(params());

        expect(result.wasAlreadyRecorded).to.equal(false);
    });

    it('refuses to re-point a token that another account already owns', async () => {
        const { store } = makeStore({ id: 'sub-1', userId: 'other-user' });

        let threw = false;
        try {
            await store.upsertByPurchaseToken(params());
        } catch (err: any) {
            threw = true;
            expect(err.message).to.contain('other-user');
        }

        expect(threw).to.equal(true);
    });

    it('rolls back and releases the client when the ownership guard trips', async () => {
        const { store, client } = makeStore({ id: 'sub-1', userId: 'other-user' });

        await store.upsertByPurchaseToken(params()).catch(() => undefined);

        // The supersede UPDATE has already run by the time the guard trips, so the
        // rollback is what keeps it from landing — a committed transaction here would
        // expire the rightful owner's active row on behalf of the second account.
        expect(client.queries).to.include('ROLLBACK');
        expect(client.queries).to.not.include('COMMIT');
        expect(client.released).to.equal(true);
    });
});
