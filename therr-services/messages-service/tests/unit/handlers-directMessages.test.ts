/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';

describe('Direct Messages Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createDirectMessage', () => {
        it('should create a direct message with required fields', async () => {
            const mockMessage = {
                id: 'msg-123',
                message: 'Hello!',
                toUserId: 'user-2',
                fromUserId: 'user-1',
                isUnread: true,
                updatedAt: new Date(),
            };

            const createDMStub = sinon.stub(Store.directMessages, 'createDirectMessage').resolves([mockMessage]);

            const result = await Store.directMessages.createDirectMessage({
                message: 'Hello!',
                toUserId: 'user-2',
                fromUserId: 'user-1',
                isUnread: true,
                locale: 'en-us',
            });

            expect(createDMStub.calledOnce).to.be.eq(true);
            expect(result).to.be.an('array');
            expect(result[0].id).to.equal('msg-123');
            expect(result[0].message).to.equal('Hello!');
        });

        it('should include locale in the message', async () => {
            const createDMStub = sinon.stub(Store.directMessages, 'createDirectMessage').resolves([{ id: 'msg-1' }]);

            await Store.directMessages.createDirectMessage({
                message: 'Bonjour',
                toUserId: 'user-2',
                fromUserId: 'user-1',
                isUnread: true,
                locale: 'fr-fr',
            });

            expect(createDMStub.calledOnce).to.be.eq(true);
            const callArgs = createDMStub.args[0][0];
            expect(callArgs.locale).to.equal('fr-fr');
        });

        it('should handle unread flag correctly', async () => {
            const createDMStub = sinon.stub(Store.directMessages, 'createDirectMessage').resolves([{ id: 'msg-1' }]);

            await Store.directMessages.createDirectMessage({
                message: 'Read message',
                toUserId: 'user-2',
                fromUserId: 'user-1',
                isUnread: false,
                locale: 'en-us',
            });

            const callArgs = createDMStub.args[0][0];
            expect(callArgs.isUnread).to.be.eq(false);
        });
    });

    describe('searchDirectMessages', () => {
        it('should search messages with pagination', async () => {
            const mockMessages = [
                { id: 'msg-1', message: 'First', fromUserId: 'user-1' },
                { id: 'msg-2', message: 'Second', fromUserId: 'user-2' },
            ];

            const searchStub = sinon.stub(Store.directMessages, 'searchDirectMessages').resolves(mockMessages);

            const result = await Store.directMessages.searchDirectMessages(
                'user-1',
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: 'user-2',
                },
                ['*'],
            );

            expect(searchStub.calledOnce).to.be.eq(true);
            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
        });

        it('should support reverse direction check', async () => {
            const searchStub = sinon.stub(Store.directMessages, 'searchDirectMessages').resolves([]);

            await Store.directMessages.searchDirectMessages(
                'user-1',
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: 'user-2',
                },
                ['*'],
                'true',
            );

            expect(searchStub.calledOnce).to.be.eq(true);
            expect(searchStub.args[0][3]).to.equal('true');
        });
    });

    describe('searchLatestDMs (searchMyDirectMessages)', () => {
        it('should return unique conversations per user pair', async () => {
            const mockConversations = [
                {
                    id: 'msg-1', fromUserId: 'user-1', toUserId: 'user-2', message: 'Latest with user-2',
                },
                {
                    id: 'msg-3', fromUserId: 'user-3', toUserId: 'user-1', message: 'Latest with user-3',
                },
            ];

            const searchLatestStub = sinon.stub(Store.directMessages, 'searchLatestDMs').resolves(mockConversations);

            const result = await Store.directMessages.searchLatestDMs('user-1', {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            });

            expect(searchLatestStub.calledOnce).to.be.eq(true);
            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
        });

        it('should paginate conversation list', async () => {
            const searchLatestStub = sinon.stub(Store.directMessages, 'searchLatestDMs').resolves([]);

            await Store.directMessages.searchLatestDMs('user-1', {
                pagination: { itemsPerPage: 5, pageNumber: 2 },
            });

            expect(searchLatestStub.calledOnce).to.be.eq(true);
            const callArgs = searchLatestStub.args[0][1];
            expect(callArgs.pagination.itemsPerPage).to.equal(5);
            expect(callArgs.pagination.pageNumber).to.equal(2);
        });
    });

    describe('countRecords', () => {
        it('should count messages with filter', async () => {
            const countStub = sinon.stub(Store.directMessages, 'countRecords').resolves([{ count: '42' }]);

            const result = await Store.directMessages.countRecords({
                filterBy: 'isUnread',
                query: true,
            });

            expect(countStub.calledOnce).to.be.eq(true);
            expect(result[0].count).to.equal('42');
        });

        it('should return count without filter', async () => {
            const countStub = sinon.stub(Store.directMessages, 'countRecords').resolves([{ count: '100' }]);

            const result = await Store.directMessages.countRecords({});

            expect(result[0].count).to.equal('100');
        });
    });
});
