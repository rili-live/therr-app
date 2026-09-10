/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import DirectMessagesStore, { ICreateDirectMessageParams } from '../../src/store/DirectMessagesStore';

describe('DirectMessagesStore', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('countRecords', () => {
        it('queries for total records with filter', () => {
            const expected = `select count(*) from "main"."directMessages" where "main"."directMessages"."brandVariation" = 'therr' and "isUnread" = false`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ count: '5' }] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.countRecords('therr', {
                filterBy: 'isUnread',
                query: false,
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });

        it('returns count in expected format', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ count: '15' }] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            const result = await store.countRecords('therr', {});

            expect(result).to.be.an('array');
            expect(result[0].count).to.equal('15');
        });
    });

    describe('searchDirectMessages', () => {
        // Parameterized: brand, userId, and query values pass through pg bindings.
        // Tests verify the SQL shape (fixed clauses + bind placeholders) and the bindings array.
        it('queries and paginates response', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchDirectMessages('therr', 'user-10', {
                pagination: {
                    itemsPerPage: 100,
                    pageNumber: 2,
                },
                filterBy: 'fromUserId',
                filterOperator: '=',
                query: 'user-7',
            }, []);

            const [queryString, bindings] = mockStore.read.query.args[0];
            expect(queryString).to.include('"fromUserId"');
            expect(queryString).to.include('LIMIT 100');
            expect(queryString).to.include('OFFSET 100'); // (2-1) * 100
            expect(queryString).to.not.include("'user-10'"); // No literal interpolation
            expect(queryString).to.not.include("'user-7'"); // No literal interpolation
            expect(bindings).to.include('user-10');
            expect(bindings).to.include('user-7');
            expect(bindings).to.include('therr');
        });

        it('calculates correct offset for first page', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchDirectMessages('therr', 'user-1', {
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, []);

            const [queryString] = mockStore.read.query.args[0];
            expect(queryString).to.include('LIMIT 20');
            expect(queryString).to.include('OFFSET 0');
        });

        it('orders by updatedAt descending', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchDirectMessages('therr', 'user-1', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, []);

            const [queryString] = mockStore.read.query.args[0];
            expect(queryString).to.include('"updatedAt" DESC');
        });

        it('applies ilike filter operator', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchDirectMessages('therr', 'user-1', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                filterBy: 'message',
                filterOperator: 'ilike',
                query: 'hello',
            }, []);

            const [queryString, bindings] = mockStore.read.query.args[0];
            expect(queryString).to.include('"message" ILIKE');
            expect(queryString).to.not.include("'%hello%'"); // No literal interpolation
            expect(bindings).to.include('%hello%');
        });

        it('falls back to "=" when filterOperator is not an allowlisted operator', () => {
            // Regression: filterOperator is a user-controlled query param interpolated raw into
            // the SQL string. Before the allowlist, an attacker-supplied operator was emitted
            // verbatim (e.g. "= (SELECT ...) OR \"message\""), surviving parameterization because
            // knex.raw only validates the binding count. Anything unrecognised must collapse to "=".
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            const injection = '= (SELECT "message" FROM "main"."directMessages" LIMIT 1) OR "message"';
            store.searchDirectMessages('therr', 'user-1', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                filterBy: 'message',
                filterOperator: injection,
                query: 'hello',
            }, []);

            const [queryString] = mockStore.read.query.args[0];
            expect(queryString).to.not.include('SELECT "message" FROM');
            expect(queryString).to.not.include('OR "message"');
            // Sanitized to the safe default comparison.
            expect(queryString).to.include('"message" =');
        });

        it('checks reverse direction when shouldCheckReverse is true', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchDirectMessages('therr', 'user-1', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                filterBy: 'fromUserId',
                filterOperator: '=',
                query: 'user-2',
            }, [], 'true');

            const [queryString, bindings] = mockStore.read.query.args[0];
            // No literal user IDs in the SQL
            expect(queryString).to.not.include("'user-1'");
            expect(queryString).to.not.include("'user-2'");
            // Parameterized placeholders present
            expect(queryString).to.include('$1');
            expect(queryString).to.include('$2');
            expect(queryString).to.include('$3');
            expect(queryString).to.include('$4');
            // Both user IDs appear twice in bindings (once per direction branch) plus brand twice
            expect(bindings.filter((b: string) => b === 'user-1').length).to.equal(2);
            expect(bindings.filter((b: string) => b === 'user-2').length).to.equal(2);
            expect(bindings.filter((b: string) => b === 'therr').length).to.equal(2);
        });

        it('returns messages in expected format', async () => {
            const mockMessages = [
                {
                    id: '1', message: 'Hello', fromUserId: 'user-1', toUserId: 'user-2',
                },
                {
                    id: '2', message: 'Hi', fromUserId: 'user-2', toUserId: 'user-1',
                },
            ];
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: mockMessages })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            const result = await store.searchDirectMessages('therr', 'user-1', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, []);

            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
        });
    });

    describe('searchLatestDMs', () => {
        // Parameterized: brand + userId pass through pg bindings, not string interpolation.
        // Tests verify the SQL shape (fixed clauses + bind placeholders) and the bindings array.
        it('queries for unique conversation threads', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchLatestDMs('therr', 'user-123', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            });

            const [queryString, bindings] = mockStore.read.query.args[0];
            expect(queryString).to.include('least("fromUserId", "toUserId")');
            expect(queryString).to.include('greatest("fromUserId", "toUserId")');
            expect(queryString).to.include('max("updatedAt")');
            expect(queryString).to.not.include("'user-123'"); // No literal interpolation.
            expect(bindings).to.deep.equal(['therr', 'therr', 'user-123', 'user-123']);
        });

        it('applies pagination correctly', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchLatestDMs('therr', 'user-123', {
                pagination: { itemsPerPage: 15, pageNumber: 3 },
            });

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('LIMIT 15');
            expect(queryString).to.include('OFFSET 30'); // (3-1) * 15
        });

        it('orders results by updatedAt descending', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchLatestDMs('therr', 'user-123', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            });

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('ORDER BY');
            expect(queryString).to.include('"updatedAt" DESC');
        });

        // Regression test for the parameterization fix: prior to this commit, brand/userId were
        // string-interpolated into raw SQL. These bindings were validated upstream (assertBrand;
        // gateway-set x-userid header) so the prior code wasn't injection-prone in practice, but
        // bypassing parameter binding is the wrong default for a raw block. Verify literally.
        it('passes brand and userId via parameter bindings, not string interpolation', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchLatestDMs('habits', 'user-abc', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            });

            const [queryString, bindings] = mockStore.read.query.args[0];
            expect(queryString).to.not.include("'habits'");
            expect(queryString).to.not.include("'user-abc'");
            // Native pg placeholders, four total: brand x2, userId x2.
            expect(queryString).to.include('$1');
            expect(queryString).to.include('$2');
            expect(queryString).to.include('$3');
            expect(queryString).to.include('$4');
            expect(bindings).to.deep.equal(['habits', 'habits', 'user-abc', 'user-abc']);
        });

        it('returns latest message per conversation', async () => {
            const mockConversations = [
                {
                    id: '1', fromUserId: 'user-123', toUserId: 'user-456', message: 'Latest',
                },
                {
                    id: '2', fromUserId: 'user-789', toUserId: 'user-123', message: 'Other convo',
                },
            ];
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: mockConversations })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            const result = await store.searchLatestDMs('therr', 'user-123', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
        });
    });

    describe('createDirectMessage', () => {
        it('inserts a new direct message', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: '1', updatedAt: new Date() }] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);

            const params: ICreateDirectMessageParams = {
                message: 'Hello there!',
                toUserId: 'user-456',
                fromUserId: 'user-123',
                isUnread: true,
                locale: 'en-us',
            };

            store.createDirectMessage('therr', params);

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('insert into "main"."directMessages"');
            expect(queryString).to.include('"message"');
            expect(queryString).to.include('"toUserId"');
            expect(queryString).to.include('"fromUserId"');
            expect(queryString).to.include('"isUnread"');
            expect(queryString).to.include('"locale"');
        });

        it('returns id and updatedAt for created message', async () => {
            const createdAt = new Date();
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{ id: 'msg-123', updatedAt: createdAt }],
                    })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);

            const result = await store.createDirectMessage('therr', {
                message: 'Test',
                toUserId: 'user-2',
                fromUserId: 'user-1',
                isUnread: true,
                locale: 'en-us',
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);
            expect(result[0].id).to.equal('msg-123');
            expect(result[0].updatedAt).to.equal(createdAt);
        });

        it('handles unread flag correctly', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: '1', updatedAt: new Date() }] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);

            store.createDirectMessage('therr', {
                message: 'Test',
                toUserId: 'user-2',
                fromUserId: 'user-1',
                isUnread: false,
                locale: 'en-us',
            });

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('false');
        });

        it('includes locale in the insert', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: '1', updatedAt: new Date() }] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);

            store.createDirectMessage('therr', {
                message: 'Bonjour',
                toUserId: 'user-2',
                fromUserId: 'user-1',
                isUnread: true,
                locale: 'fr-fr',
            });

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('fr-fr');
        });
    });
});
