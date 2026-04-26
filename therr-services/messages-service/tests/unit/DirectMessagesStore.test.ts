/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import DirectMessagesStore, { DIRECT_MESSAGES_TABLE_NAME, ICreateDirectMessageParams } from '../../src/store/DirectMessagesStore';

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
        it('queries and paginates response', () => {
            const expected = `select * from "main"."directMessages" where "main"."directMessages"."brandVariation" = 'therr' and "toUserId" = 10 and "main"."directMessages"."toUserId" > 7 order by "main"."directMessages"."updatedAt" desc limit 100 offset 100`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new DirectMessagesStore(mockStore as any);
            store.searchDirectMessages('therr', 10, {
                pagination: {
                    itemsPerPage: 100,
                    pageNumber: 2,
                },
                filterBy: `${DIRECT_MESSAGES_TABLE_NAME}.toUserId`,
                filterOperator: '>',
                query: 7,
            }, []);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
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

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('limit 20');
            // Knex omits offset clause when offset is 0
            expect(queryString).to.not.include('offset 20');
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

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`order by "main"."directMessages"."updatedAt" desc`);
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

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`"message" ilike '%hello%'`);
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

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`"toUserId" = 'user-1'`);
            expect(queryString).to.include(`"fromUserId" = 'user-2'`);
            expect(queryString).to.include(`"fromUserId" = 'user-1'`);
            expect(queryString).to.include(`"toUserId" = 'user-2'`);
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

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('user-123');
            expect(queryString).to.include('least("fromUserId", "toUserId")');
            expect(queryString).to.include('greatest("fromUserId", "toUserId")');
            expect(queryString).to.include('max("updatedAt")');
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
