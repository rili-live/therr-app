/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import ForumMessagesStore, { FORUM_MESSAGES_TABLE_NAME, ICreateForumMessageParams } from '../../src/store/ForumMessagesStore';

describe('ForumMessagesStore', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('countRecords', () => {
        it('queries for total records with filter', () => {
            const expected = `select count(*) from "main"."forumMessages" where "isAnnouncement" = false`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ count: '10' }] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.countRecords({
                filterBy: 'isAnnouncement',
                query: false,
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });

        it('returns count in expected format', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ count: '25' }] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            const result = await store.countRecords({});

            expect(result).to.be.an('array');
            expect(result[0].count).to.equal('25');
        });
    });

    describe('searchForumMessages', () => {
        it('queries messages for a specific forum with pagination', () => {
            const forumId = 123;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.searchForumMessages(forumId, {
                pagination: {
                    itemsPerPage: 20,
                    pageNumber: 1,
                },
            }, []);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`"forumId" = ${forumId}`);
            expect(queryString).to.include('limit 20');
            // Knex omits offset clause when offset is 0
            expect(queryString).to.not.include('offset 20');
        });

        it('excludes announcements by default', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.searchForumMessages(1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, []);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('"isAnnouncement" = false');
        });

        it('orders by createdAt descending', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.searchForumMessages(1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, []);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`order by "main"."forumMessages"."createdAt" desc`);
        });

        it('calculates correct offset for page 3', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.searchForumMessages(1, {
                pagination: { itemsPerPage: 15, pageNumber: 3 },
            }, []);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('limit 15');
            expect(queryString).to.include('offset 30'); // (3-1) * 15
        });

        it('applies filter conditions with equals operator', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.searchForumMessages(1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                filterBy: 'fromUserId',
                filterOperator: '=',
                query: 'user-123',
            }, []);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`"fromUserId" = 'user-123'`);
        });

        it('applies filter conditions with ilike operator', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.searchForumMessages(1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                filterBy: 'message',
                filterOperator: 'ilike',
                query: 'hello',
            }, []);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`"message" ilike '%hello%'`);
        });

        it('returns messages in expected format', async () => {
            const mockMessages = [
                {
                    id: 1, forumId: 1, message: 'Hello', fromUserId: 'user-1',
                },
                {
                    id: 2, forumId: 1, message: 'World', fromUserId: 'user-2',
                },
            ];
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: mockMessages })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            const result = await store.searchForumMessages(1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, []);

            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
            expect(result[0].message).to.equal('Hello');
        });

        it('uses custom returning columns when provided', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);
            store.searchForumMessages(1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, ['id', 'message', 'createdAt']);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('select "id", "message", "createdAt"');
        });
    });

    describe('createForumMessage', () => {
        it('inserts a new forum message', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 1, updatedAt: new Date() }] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);

            const params: ICreateForumMessageParams = {
                forumId: 1,
                message: 'Test message',
                fromUserId: 'user-123',
                fromUserLocale: 1,
                isAnnouncement: false,
            };

            store.createForumMessage(params);

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('insert into "main"."forumMessages"');
            expect(queryString).to.include('"forumId"');
            expect(queryString).to.include('"message"');
            expect(queryString).to.include('"fromUserId"');
        });

        it('returns id and updatedAt for created message', async () => {
            const createdAt = new Date();
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{ id: 42, updatedAt: createdAt }],
                    })),
                },
            };
            const store = new ForumMessagesStore(mockStore);

            const result = await store.createForumMessage({
                forumId: 1,
                message: 'Test',
                fromUserId: 'user-1',
                fromUserLocale: 1,
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);
            expect(result[0].id).to.equal(42);
            expect(result[0].updatedAt).to.equal(createdAt);
        });

        it('handles announcement messages', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 1, updatedAt: new Date() }] })),
                },
            };
            const store = new ForumMessagesStore(mockStore);

            store.createForumMessage({
                forumId: 1,
                message: 'Important announcement',
                fromUserId: 'admin-user',
                fromUserLocale: 1,
                isAnnouncement: true,
            });

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('"isAnnouncement"');
        });
    });
});
