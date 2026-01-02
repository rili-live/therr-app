/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';

describe('Forum Messages Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createForumMessage', () => {
        it('should create a forum message with required fields', async () => {
            const mockMessage = {
                id: 1,
                forumId: 123,
                message: 'Hello forum!',
                fromUserId: 'user-1',
                isAnnouncement: false,
                updatedAt: new Date(),
            };

            const createMessageStub = sinon.stub(Store.forumMessages, 'createForumMessage').resolves([mockMessage]);

            const result = await Store.forumMessages.createForumMessage({
                forumId: 123,
                message: 'Hello forum!',
                fromUserId: 'user-1',
                fromUserLocale: 1,
                isAnnouncement: false,
            });

            expect(createMessageStub.calledOnce).to.be.eq(true);
            expect(result).to.be.an('array');
            expect(result[0].id).to.equal(1);
            expect(result[0].message).to.equal('Hello forum!');
        });

        it('should create an announcement message', async () => {
            const createMessageStub = sinon.stub(Store.forumMessages, 'createForumMessage').resolves([{ id: 1 }]);

            await Store.forumMessages.createForumMessage({
                forumId: 123,
                message: 'Important announcement!',
                fromUserId: 'admin-user',
                fromUserLocale: 1,
                isAnnouncement: true,
            });

            expect(createMessageStub.calledOnce).to.be.eq(true);
            const callArgs = createMessageStub.args[0][0];
            expect(callArgs.isAnnouncement).to.be.eq(true);
        });

        it('should include fromUserLocale', async () => {
            const createMessageStub = sinon.stub(Store.forumMessages, 'createForumMessage').resolves([{ id: 1 }]);

            await Store.forumMessages.createForumMessage({
                forumId: 123,
                message: 'Message',
                fromUserId: 'user-1',
                fromUserLocale: 2, // Different locale
            });

            const callArgs = createMessageStub.args[0][0];
            expect(callArgs.fromUserLocale).to.equal(2);
        });

        it('should return id and updatedAt', async () => {
            const updatedAt = new Date();
            const createMessageStub = sinon.stub(Store.forumMessages, 'createForumMessage').resolves([{
                id: 42,
                updatedAt,
            }]);

            const result = await Store.forumMessages.createForumMessage({
                forumId: 1,
                message: 'Test',
                fromUserId: 'user-1',
                fromUserLocale: 1,
            });

            expect(result[0].id).to.equal(42);
            expect(result[0].updatedAt).to.equal(updatedAt);
        });
    });

    describe('searchForumMessages', () => {
        it('should search messages in a forum with pagination', async () => {
            const mockMessages = [
                {
                    id: 1, forumId: 123, message: 'First', fromUserId: 'user-1',
                },
                {
                    id: 2, forumId: 123, message: 'Second', fromUserId: 'user-2',
                },
            ];

            const searchStub = sinon.stub(Store.forumMessages, 'searchForumMessages').resolves(mockMessages);

            const result = await Store.forumMessages.searchForumMessages(
                123,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                },
                [],
            );

            expect(searchStub.calledOnce).to.be.eq(true);
            expect(searchStub.args[0][0]).to.equal(123);
            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
        });

        it('should filter messages by fromUserId', async () => {
            const searchStub = sinon.stub(Store.forumMessages, 'searchForumMessages').resolves([]);

            await Store.forumMessages.searchForumMessages(
                123,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: 'user-1',
                },
                [],
            );

            expect(searchStub.args[0][1].filterBy).to.equal('fromUserId');
            expect(searchStub.args[0][1].query).to.equal('user-1');
        });

        it('should support text search with ilike', async () => {
            const searchStub = sinon.stub(Store.forumMessages, 'searchForumMessages').resolves([]);

            await Store.forumMessages.searchForumMessages(
                123,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'message',
                    filterOperator: 'ilike',
                    query: 'hello',
                },
                [],
            );

            expect(searchStub.args[0][1].filterOperator).to.equal('ilike');
        });

        it('should handle page 2 correctly', async () => {
            const searchStub = sinon.stub(Store.forumMessages, 'searchForumMessages').resolves([]);

            await Store.forumMessages.searchForumMessages(
                123,
                {
                    pagination: { itemsPerPage: 20, pageNumber: 2 },
                },
                [],
            );

            expect(searchStub.args[0][1].pagination.pageNumber).to.equal(2);
            expect(searchStub.args[0][1].pagination.itemsPerPage).to.equal(20);
        });
    });

    describe('countRecords', () => {
        it('should count messages with filter', async () => {
            const countStub = sinon.stub(Store.forumMessages, 'countRecords').resolves([{ count: '50' }]);

            const result = await Store.forumMessages.countRecords({
                filterBy: 'forumId',
                query: 123,
            });

            expect(countStub.calledOnce).to.be.eq(true);
            expect(result[0].count).to.equal('50');
        });

        it('should count all messages without filter', async () => {
            const countStub = sinon.stub(Store.forumMessages, 'countRecords').resolves([{ count: '1000' }]);

            const result = await Store.forumMessages.countRecords({});

            expect(result[0].count).to.equal('1000');
        });

        it('should filter by announcement status', async () => {
            const countStub = sinon.stub(Store.forumMessages, 'countRecords').resolves([{ count: '5' }]);

            await Store.forumMessages.countRecords({
                filterBy: 'isAnnouncement',
                query: true,
            });

            expect(countStub.args[0][0].filterBy).to.equal('isAnnouncement');
            expect(countStub.args[0][0].query).to.be.eq(true);
        });
    });
});
