/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import InvitesStore from '../../src/store/InvitesStore';

describe('InvitesStore', () => {
    describe('createIfNotExist', () => {
        // Regression: knex emits an empty string for `.insert([])` and pg rejects an
        // empty query. The bulk-invite handler passes only the existing-user subset
        // here, which is empty whenever every invited contact is new to the platform
        // — the common case for an invite flow. The rejection short-circuited the
        // caller's promise chain, skipping the socialite achievement and leaving the
        // already-in-flight email/SMS send promises without a handler.
        it('resolves with an empty array without querying when there are no invites', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.reject(new Error('empty query'))),
                },
            };
            const store = new InvitesStore(mockStore);

            const result = await store.createIfNotExist([]);

            expect(result).to.deep.equal([]);
            expect(mockStore.write.query.called).to.be.equal(false);
        });

        it('inserts and ignores conflicts when invites are present', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 'invite-1' }] })),
                },
            };
            const store = new InvitesStore(mockStore);

            await store.createIfNotExist([{
                requestingUserId: 'user-1',
                email: 'invitee@example.com',
                isAccepted: false,
            }]);

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.contain('insert into "main"."invites"');
            expect(queryString).to.contain('do nothing');
        });
    });

    describe('upsertInvitesWithTokens', () => {
        it('resolves with an empty array without querying when there are no invites', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new InvitesStore(mockStore);

            const result = await store.upsertInvitesWithTokens('email', []);

            expect(result).to.deep.equal([]);
            expect(mockStore.write.query.called).to.be.equal(false);
        });

        // Regression: email/phoneNumber are globally unique on main.invites, so a
        // contact already invited by someone else owns the row. Merging only `token`
        // handed the new inviter's magic link to the original inviter's row — the
        // invitee would be auto-connected to, and the coins credited to, the wrong
        // user. The refreshed token invalidates the older link, so the latest
        // inviter must take ownership of the row.
        it('transfers row ownership to the latest inviter when refreshing the token', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new InvitesStore(mockStore);

            await store.upsertInvitesWithTokens('email', [{
                requestingUserId: 'user-b',
                email: 'invitee@example.com',
                isAccepted: false,
                token: 'token-b',
            }]);

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.contain('on conflict ("email") do update set');
            expect(queryString).to.contain('"token" = excluded."token"');
            expect(queryString).to.contain('"requestingUserId" = excluded."requestingUserId"');
        });

        it('conflicts on phoneNumber when persisting the SMS channel', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new InvitesStore(mockStore);

            await store.upsertInvitesWithTokens('phoneNumber', [{
                requestingUserId: 'user-a',
                phoneNumber: '+15555555555',
                isAccepted: false,
                token: 'token-a',
            }]);

            expect(mockStore.write.query.args[0][0]).to.contain('on conflict ("phoneNumber") do update set');
        });
    });

    describe('getInviteByToken', () => {
        it('resolves a token to the invite joined with the inviter display fields', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 'invite-1' }] })),
                },
            };
            const store = new InvitesStore(mockStore);

            const result = await store.getInviteByToken('some-token');

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.contain('left join "main"."users"');
            expect(queryString).to.contain(`"main"."invites"."token" = 'some-token'`);
            expect(result).to.deep.equal({ id: 'invite-1' });
        });

        it('resolves undefined for an unknown token', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new InvitesStore(mockStore);

            expect(await store.getInviteByToken('nope')).to.be.equal(undefined);
        });
    });
});
