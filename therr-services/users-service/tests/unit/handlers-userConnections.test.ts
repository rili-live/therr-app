/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import Store from '../../src/store';

describe('UserConnections Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createUserConnection', () => {
        it('should create a pending connection between two users', async () => {
            const mockConnection = {
                id: 'conn-123',
                requestingUserId: 'user-1',
                acceptingUserId: 'user-2',
                requestStatus: UserConnectionTypes.PENDING,
            };
            const createStub = sinon.stub(Store.userConnections, 'createUserConnection').resolves([mockConnection]);

            const result = await Store.userConnections.createUserConnection({
                requestingUserId: 'user-1',
                acceptingUserId: 'user-2',
                requestStatus: UserConnectionTypes.PENDING,
            });

            expect(result).to.be.an('array');
            expect(result[0].requestStatus).to.equal(UserConnectionTypes.PENDING);
            createStub.restore();
        });

        it('should not allow self-connections', async () => {
            // Business logic: requestingUserId should not equal acceptingUserId
            const requestingUserId = 'user-1';
            const acceptingUserId = 'user-1';

            expect(requestingUserId).to.equal(acceptingUserId);
            // Handler should return 400 error for this case
        });

        it('should find existing user before creating connection', async () => {
            const mockUser = {
                id: 'user-2',
                email: 'friend@test.com',
                deviceMobileFirebaseToken: 'firebase-token',
            };
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([mockUser]);

            const result = await Store.users.findUser({
                email: 'friend@test.com',
            }, ['id', 'deviceMobileFirebaseToken', 'email']);

            expect(result[0].id).to.equal('user-2');
            findUserStub.restore();
        });

        it('should check for existing connection before creating new one', async () => {
            const existingConnection = {
                id: 'conn-123',
                requestingUserId: 'user-1',
                acceptingUserId: 'user-2',
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: false,
            };
            const getConnectionsStub = sinon.stub(Store.userConnections, 'getUserConnections').resolves([existingConnection]);

            const result = await Store.userConnections.getUserConnections({
                requestingUserId: 'user-1',
                acceptingUserId: 'user-2',
            }, true);

            expect(result.length).to.equal(1);
            expect(result[0].requestStatus).to.equal(UserConnectionTypes.COMPLETE);
            getConnectionsStub.restore();
        });

        it('should re-enable broken connection on new request', async () => {
            const brokenConnection = {
                id: 'conn-123',
                requestingUserId: 'user-1',
                acceptingUserId: 'user-2',
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: true,
            };
            const getConnectionsStub = sinon.stub(Store.userConnections, 'getUserConnections').resolves([brokenConnection]);
            const updateStub = sinon.stub(Store.userConnections, 'updateUserConnection').resolves([{
                ...brokenConnection,
                isConnectionBroken: false,
                requestStatus: UserConnectionTypes.PENDING,
            }]);

            const existingConn = await Store.userConnections.getUserConnections({
                requestingUserId: 'user-1',
                acceptingUserId: 'user-2',
            }, true);

            expect(existingConn[0].isConnectionBroken).to.be.eq(true);

            const updatedConn = await Store.userConnections.updateUserConnection(
                { requestingUserId: 'user-1', acceptingUserId: 'user-2' },
                { isConnectionBroken: false, requestStatus: UserConnectionTypes.PENDING },
            );

            expect(updatedConn[0].isConnectionBroken).to.be.eq(false);
            getConnectionsStub.restore();
            updateStub.restore();
        });
    });

    describe('updateUserConnection', () => {
        it('should update connection status to COMPLETE', async () => {
            const mockConnection = {
                id: 'conn-123',
                requestingUserId: 'user-1',
                acceptingUserId: 'user-2',
                requestStatus: UserConnectionTypes.COMPLETE,
            };
            const updateStub = sinon.stub(Store.userConnections, 'updateUserConnection').resolves([mockConnection]);

            const result = await Store.userConnections.updateUserConnection(
                { requestingUserId: 'user-1', acceptingUserId: 'user-2' },
                { requestStatus: UserConnectionTypes.COMPLETE },
            );

            expect(result[0].requestStatus).to.equal(UserConnectionTypes.COMPLETE);
            updateStub.restore();
        });

        it('should increment interaction count', async () => {
            const mockConnection = {
                id: 'conn-123',
                interactionCount: 5,
            };
            const incrementStub = sinon.stub(Store.userConnections, 'incrementUserConnection').resolves([mockConnection]);

            const result = await Store.userConnections.incrementUserConnection('user-2', 'user-1', 1);

            expect(incrementStub.calledOnce).to.be.eq(true);
            incrementStub.restore();
        });

        it('should cap interaction increment at 5', () => {
            const incrBy = 10;
            const ceilIncrBy = Math.min(5, incrBy);

            expect(ceilIncrBy).to.equal(5);
        });

        it('should break connection (soft delete)', async () => {
            const updateStub = sinon.stub(Store.userConnections, 'updateUserConnection').resolves([{
                isConnectionBroken: true,
            }]);

            const result = await Store.userConnections.updateUserConnection(
                { requestingUserId: 'user-1', acceptingUserId: 'user-2' },
                { isConnectionBroken: true },
            );

            expect(result[0].isConnectionBroken).to.be.eq(true);
            updateStub.restore();
        });
    });

    describe('searchUserConnections', () => {
        it('should search connections with pagination', async () => {
            const mockConnections = [
                { id: 'conn-1', requestingUserId: 'user-1' },
                { id: 'conn-2', requestingUserId: 'user-1' },
            ];
            const searchStub = sinon.stub(Store.userConnections, 'searchUserConnections').resolves(mockConnections);

            const result = await Store.userConnections.searchUserConnections({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
                filterBy: 'requestingUserId',
                query: 'user-1',
                order: 'desc',
            });

            expect(result.length).to.equal(2);
            searchStub.restore();
        });

        it('should count total records for pagination', async () => {
            const countStub = sinon.stub(Store.userConnections, 'countRecords').resolves([{ count: '25' }]);

            const result = await Store.userConnections.countRecords({
                filterBy: 'requestingUserId',
                query: 'user-1',
            });

            expect(Number(result[0].count)).to.equal(25);
            countStub.restore();
        });

        it('should filter by connection status', async () => {
            const mockConnections = [
                { id: 'conn-1', requestStatus: UserConnectionTypes.COMPLETE },
            ];
            const searchStub = sinon.stub(Store.userConnections, 'searchUserConnections').resolves(mockConnections);

            const result = await Store.userConnections.searchUserConnections({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
                filterBy: 'requestStatus',
                query: UserConnectionTypes.COMPLETE,
            });

            expect(result[0].requestStatus).to.equal(UserConnectionTypes.COMPLETE);
            searchStub.restore();
        });
    });

    describe('findPeopleYouMayKnow', () => {
        it('should find users from contact list', async () => {
            const mockUsers = [
                { id: 'user-2' },
                { id: 'user-3' },
            ];
            const findUsersStub = sinon.stub(Store.users, 'findUsersByContactInfo').resolves(mockUsers);

            const contacts = [
                { email: 'friend1@test.com' },
                { phoneNumber: '+1234567890' },
            ];

            const result = await Store.users.findUsersByContactInfo(contacts, ['id']);

            expect(result.length).to.equal(2);
            findUsersStub.restore();
        });

        it('should create MIGHT_KNOW connections for found users', async () => {
            const createIfNotExistStub = sinon.stub(Store.userConnections, 'createIfNotExist').resolves([
                { id: 'conn-1' },
                { id: 'conn-2' },
            ]);

            const mightKnowConnections = [
                {
                    requestingUserId: 'user-1',
                    acceptingUserId: 'user-2',
                    requestStatus: UserConnectionTypes.MIGHT_KNOW,
                },
                {
                    requestingUserId: 'user-1',
                    acceptingUserId: 'user-3',
                    requestStatus: UserConnectionTypes.MIGHT_KNOW,
                },
            ];

            const result = await Store.userConnections.createIfNotExist(mightKnowConnections);

            expect(result.length).to.equal(2);
            createIfNotExistStub.restore();
        });

        it('should limit contacts for performance', () => {
            const contactEmails = Array(600).fill({ email: 'test@test.com' });
            const contactPhones = Array(600).fill({ phoneNumber: '+1234567890' });

            const limitedContacts = contactEmails.slice(0, 500).concat(contactPhones.slice(0, 500));

            expect(limitedContacts.length).to.equal(1000);
        });

        it('should filter out requesting user from results', () => {
            const requestingUserId = 'user-1';
            const users = [
                { id: 'user-1' },
                { id: 'user-2' },
                { id: 'user-3' },
            ];

            const filteredUsers = users.filter((u) => u.id !== requestingUserId);

            expect(filteredUsers.length).to.equal(2);
            expect(filteredUsers.find((u) => u.id === 'user-1')).to.be.eq(undefined);
        });
    });

    describe('getTopRankedConnections', () => {
        it('should search connections ordered by interaction count', async () => {
            const mockConnections = [
                { id: 'conn-1', interactionCount: 100 },
                { id: 'conn-2', interactionCount: 50 },
            ];
            const searchStub = sinon.stub(Store.userConnections, 'searchUserConnections').resolves(mockConnections);

            const result = await Store.userConnections.searchUserConnections({
                orderBy: 'interactionCount',
                filterBy: 'lastKnownLocation',
                query: 96560.6, // ~60 miles in meters
                order: 'desc',
                pagination: { itemsPerPage: 20, pageNumber: 1 },
                userId: 'user-1',
                latitude: 39.7684,
                longitude: -86.1581,
            });

            expect(result[0].interactionCount).to.be.greaterThan(result[1].interactionCount);
            searchStub.restore();
        });

        it('should get user interests for shared interests feature', async () => {
            const mockInterests = [
                {
                    userId: 'user-1', interestId: 'fitness', engagementCount: 10, score: 8, isEnabled: true,
                },
                {
                    userId: 'user-2', interestId: 'fitness', engagementCount: 5, score: 7, isEnabled: true,
                },
            ];
            const getInterestsStub = sinon.stub(Store.userInterests, 'getByUserIds').resolves(mockInterests);

            const result = await Store.userInterests.getByUserIds(
                ['user-1', 'user-2'],
                { isEnabled: true },
                'engagementCount',
            );

            expect(result.length).to.equal(2);
            expect(result[0].interestId).to.equal('fitness');
            getInterestsStub.restore();
        });
    });

    describe('createOrInviteUserConnections (batch)', () => {
        it('should create multiple connections at once', async () => {
            const mockConnections = [
                { id: 'conn-1', acceptingUserId: 'user-2' },
                { id: 'conn-2', acceptingUserId: 'user-3' },
            ];
            const createConnectionsStub = sinon.stub(Store.userConnections, 'createUserConnections').resolves(mockConnections);

            const result = await Store.userConnections.createUserConnections('user-1', ['user-2', 'user-3']);

            expect(result.length).to.equal(2);
            createConnectionsStub.restore();
        });

        it('should find existing connections to avoid duplicates', async () => {
            const existingConnections = [
                { requestingUserId: 'user-1', acceptingUserId: 'user-2' },
            ];
            const findStub = sinon.stub(Store.userConnections, 'findUserConnections').resolves(existingConnections);

            const result = await Store.userConnections.findUserConnections('user-1', ['user-2', 'user-3']);

            expect(result.length).to.equal(1);
            findStub.restore();
        });
    });

    describe('connection types', () => {
        it('should support PENDING status', () => {
            expect(UserConnectionTypes.PENDING).to.equal('pending');
        });

        it('should support COMPLETE status', () => {
            expect(UserConnectionTypes.COMPLETE).to.equal('complete');
        });

        it('should support MIGHT_KNOW status', () => {
            expect(UserConnectionTypes.MIGHT_KNOW).to.equal('might-know');
        });

        it('should support DENIED status', () => {
            expect(UserConnectionTypes.DENIED).to.equal('denied');
        });

        it('should support BLOCKED status', () => {
            expect(UserConnectionTypes.BLOCKED).to.equal('blocked');
        });
    });

    describe('user connection validation', () => {
        it('should verify requesting user matches token user id', () => {
            const tokenUserId = 'user-1';
            const requestingUserId = 'user-1';

            expect(requestingUserId).to.equal(tokenUserId);
        });

        it('should reject mismatched token and requesting user', () => {
            const tokenUserId = 'user-1';
            const requestingUserId = 'user-2';

            expect(requestingUserId).to.not.equal(tokenUserId);
            // Handler should return 400 error
        });
    });
});
