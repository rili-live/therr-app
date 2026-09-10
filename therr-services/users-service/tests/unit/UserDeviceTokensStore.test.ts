/* eslint-disable quotes, max-len */
/**
 * Push routing takes `rows[0]` from these queries as *the* device to send to, so the ORDER BY
 * is load-bearing rather than cosmetic: without it, a user holding more than one row for a
 * brand (two devices, or a legacy 'mobile' row alongside a real 'android' one) gets whichever
 * row Postgres happens to return first, which can differ between runs.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import UserDeviceTokensStore, { LEGACY_TOKEN_PLATFORM } from '../../src/store/UserDeviceTokensStore';

const buildMockConnection = () => {
    const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    const writeStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [], rowCount: 0 }));
    return {
        connection: {
            read: { query: readStub } as any,
            write: { query: writeStub } as any,
        },
        readStub,
        writeStub,
    };
};

describe('UserDeviceTokensStore', () => {
    describe('getTokensForUser', () => {
        it('scopes by brand and returns the freshest registration first', () => {
            const expected = `select * from "main"."userDeviceTokens" where "main"."userDeviceTokens"."brandVariation" = 'habits' and "userId" = 'user-1' order by "updatedAt" desc`;
            const { connection, readStub } = buildMockConnection();
            const store = new UserDeviceTokensStore(connection);

            store.getTokensForUser('habits', 'user-1');

            expect(readStub.args[0][0]).to.equal(expected);
        });
    });

    describe('getTokensForUsers', () => {
        it('applies the same newest-first ordering to the batch read', () => {
            const expected = `select * from "main"."userDeviceTokens" where "main"."userDeviceTokens"."brandVariation" = 'habits' and "userId" in ('user-1', 'user-2') order by "updatedAt" desc`;
            const { connection, readStub } = buildMockConnection();
            const store = new UserDeviceTokensStore(connection);

            store.getTokensForUsers('habits', ['user-1', 'user-2']);

            expect(readStub.args[0][0]).to.equal(expected);
        });

        it('short-circuits without querying when there are no recipients', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new UserDeviceTokensStore(connection);

            store.getTokensForUsers('habits', []);

            expect(readStub.called).to.equal(false);
        });
    });

    describe('deleteLegacyPlatformRow', () => {
        it('deletes only this user + brand row filed under the legacy platform', () => {
            const expected = `delete from "main"."userDeviceTokens" where "main"."userDeviceTokens"."brandVariation" = 'habits' and "userId" = 'user-1' and "platform" = '${LEGACY_TOKEN_PLATFORM}'`;
            const { connection, writeStub } = buildMockConnection();
            const store = new UserDeviceTokensStore(connection);

            store.deleteLegacyPlatformRow('habits', 'user-1');

            expect(writeStub.args[0][0]).to.equal(expected);
        });
    });
});
