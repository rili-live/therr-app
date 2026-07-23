/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { Notifications, UserConnectionTypes } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    acceptInvitesOnFirstLogin,
    ensureCompletedUserConnection,
} from '../../src/handlers/helpers/inviteAcceptance';

/**
 * Regression tests for the first-login invite → connection contract.
 *
 * The HABITS viral loop (and Therr's referral loop) depends on one guarantee:
 * when a user who was invited by e-mail/SMS signs in for the first time, they
 * end up CONNECTED to the user who invited them — not just "invite marked
 * accepted". These tests pin that behavior so a refactor of the login flow
 * can't silently drop the connection step again.
 */
describe('Invite acceptance on first login', () => {
    const INVITEE = {
        id: 'invitee-user-id',
        email: 'newuser@test.com',
        phoneNumber: '+15551230000',
        firstName: 'New',
        lastName: 'User',
    };
    const INVITER_ID = 'inviter-user-id';
    const HEADERS = {
        'x-localecode': 'en-us',
        'x-brand-variation': 'habits',
        'x-therr-origin-host': 'test-host',
    };

    let getInvitesForEmailStub: sinon.SinonStub;
    let getInvitesForPhoneStub: sinon.SinonStub;
    let updateInviteStub: sinon.SinonStub;
    let updateUserStub: sinon.SinonStub;
    let getUserConnectionsStub: sinon.SinonStub;
    let createUserConnectionStub: sinon.SinonStub;
    let updateUserConnectionStub: sinon.SinonStub;
    let createNotificationStub: sinon.SinonStub;

    beforeEach(() => {
        getInvitesForEmailStub = sinon.stub(Store.invites, 'getInvitesForEmail').resolves([]);
        getInvitesForPhoneStub = sinon.stub(Store.invites, 'getInvitesForPhoneNumber').resolves([]);
        updateInviteStub = sinon.stub(Store.invites, 'updateInvite')
            .callsFake((conditions: any) => Promise.resolve([{ id: conditions.id, isAccepted: true }]));
        updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: INVITER_ID }]);
        // Push-notification path resolves no user → utility no-ops (hermetic test)
        sinon.stub(Store.users, 'findUser').resolves([]);
        getUserConnectionsStub = sinon.stub(Store.userConnections, 'getUserConnections').resolves([]);
        createUserConnectionStub = sinon.stub(Store.userConnections, 'createUserConnection')
            .callsFake((params: any) => Promise.resolve([{ id: 'new-connection-id', ...params }]));
        updateUserConnectionStub = sinon.stub(Store.userConnections, 'updateUserConnection')
            .callsFake((conditions: any, params: any) => Promise.resolve([{ id: 'existing-connection-id', ...conditions, ...params }]));
        createNotificationStub = sinon.stub(Store.notifications, 'createNotification').resolves([{ id: 'notification-id' }]);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('acceptInvitesOnFirstLogin', () => {
        it('accepts a pending e-mail invite AND creates a COMPLETE connection to the inviter (regression)', async () => {
            getInvitesForEmailStub.resolves([
                { id: 'invite-1', requestingUserId: INVITER_ID, email: INVITEE.email },
            ]);

            const result = await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            // Invite is marked accepted
            expect(updateInviteStub.calledOnce).to.equal(true);
            expect(updateInviteStub.firstCall.args[0]).to.deep.equal({ id: 'invite-1' });
            expect(updateInviteStub.firstCall.args[1]).to.deep.equal({ isAccepted: true });

            // THE contract: a COMPLETE connection now exists between inviter and invitee
            expect(createUserConnectionStub.calledOnce).to.equal(true);
            expect(createUserConnectionStub.firstCall.args[0]).to.deep.equal({
                requestingUserId: INVITER_ID,
                acceptingUserId: INVITEE.id,
                requestStatus: UserConnectionTypes.COMPLETE,
            });

            expect(result.acceptedInviteIds).to.deep.equal(['invite-1']);
            expect(result.connectedUserIds).to.deep.equal([INVITER_ID]);
        });

        it('accepts a pending phone invite and connects the inviter (regression)', async () => {
            getInvitesForPhoneStub.resolves([
                { id: 'invite-2', requestingUserId: INVITER_ID, phoneNumber: INVITEE.phoneNumber },
            ]);

            const result = await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            expect(updateInviteStub.calledOnceWith({ id: 'invite-2' }, { isAccepted: true })).to.equal(true);
            expect(createUserConnectionStub.calledOnce).to.equal(true);
            expect(result.connectedUserIds).to.deep.equal([INVITER_ID]);
        });

        it('rewards the inviter with coins on first login', async () => {
            getInvitesForEmailStub.resolves([
                { id: 'invite-1', requestingUserId: INVITER_ID, email: INVITEE.email },
            ]);

            await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            expect(updateUserStub.calledOnce).to.equal(true);
            expect(updateUserStub.firstCall.args[1]).to.deep.equal({ id: INVITER_ID });
            expect(updateUserStub.firstCall.args[0]).to.have.property('settingsTherrCoinTotal');
        });

        it('creates an in-app notification for the inviter that their friend joined', async () => {
            getInvitesForEmailStub.resolves([
                { id: 'invite-1', requestingUserId: INVITER_ID, email: INVITEE.email },
            ]);

            await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            expect(createNotificationStub.calledOnce).to.equal(true);
            const [brand, notification] = createNotificationStub.firstCall.args;
            expect(brand).to.equal('habits');
            expect(notification.userId).to.equal(INVITER_ID);
            expect(notification.type).to.equal(Notifications.Types.CONNECTION_REQUEST_ACCEPTED);
            expect(notification.messageParams.firstName).to.equal(INVITEE.firstName);
        });

        it('handles invites matching BOTH email and phone from multiple inviters — one connection per distinct inviter', async () => {
            const secondInviterId = 'second-inviter-id';
            getInvitesForEmailStub.resolves([
                { id: 'invite-1', requestingUserId: INVITER_ID, email: INVITEE.email },
            ]);
            getInvitesForPhoneStub.resolves([
                { id: 'invite-2', requestingUserId: secondInviterId, phoneNumber: INVITEE.phoneNumber },
                // Duplicate row for the same first inviter must not double-connect
                { id: 'invite-3', requestingUserId: INVITER_ID, phoneNumber: INVITEE.phoneNumber },
            ]);

            const result = await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            expect(result.acceptedInviteIds).to.have.members(['invite-1', 'invite-2', 'invite-3']);
            expect(createUserConnectionStub.callCount).to.equal(2);
            expect(result.connectedUserIds).to.have.members([INVITER_ID, secondInviterId]);
        });

        it('does not duplicate an existing connection — promotes it to COMPLETE instead', async () => {
            getInvitesForEmailStub.resolves([
                { id: 'invite-1', requestingUserId: INVITER_ID, email: INVITEE.email },
            ]);
            getUserConnectionsStub.resolves([{
                id: 'existing-connection-id',
                requestingUserId: INVITER_ID,
                acceptingUserId: INVITEE.id,
                requestStatus: UserConnectionTypes.PENDING,
                isConnectionBroken: false,
            }]);

            const result = await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            expect(createUserConnectionStub.notCalled).to.equal(true);
            expect(updateUserConnectionStub.calledOnce).to.equal(true);
            expect(updateUserConnectionStub.firstCall.args[1]).to.deep.equal({
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: false,
            });
            expect(result.connectedUserIds).to.deep.equal([INVITER_ID]);
        });

        it('is a no-op when there are no pending invites', async () => {
            const result = await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            expect(updateInviteStub.notCalled).to.equal(true);
            expect(createUserConnectionStub.notCalled).to.equal(true);
            expect(updateUserStub.notCalled).to.equal(true);
            expect(result.acceptedInviteIds).to.deep.equal([]);
            expect(result.connectedUserIds).to.deep.equal([]);
        });

        it('is a no-op when the user has neither email nor phone', async () => {
            const result = await acceptInvitesOnFirstLogin(HEADERS, { id: INVITEE.id });

            expect(getInvitesForEmailStub.notCalled).to.equal(true);
            expect(getInvitesForPhoneStub.notCalled).to.equal(true);
            expect(result.acceptedInviteIds).to.deep.equal([]);
        });

        it('never connects a user to themselves (self-invite guard)', async () => {
            getInvitesForEmailStub.resolves([
                { id: 'invite-1', requestingUserId: INVITEE.id, email: INVITEE.email },
            ]);

            const result = await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            // Invite still gets marked accepted (cleanup), but no connection is made
            expect(updateInviteStub.calledOnce).to.equal(true);
            expect(createUserConnectionStub.notCalled).to.equal(true);
            expect(result.connectedUserIds).to.deep.equal([]);
        });

        it('still connects the inviter even when marking one invite accepted fails', async () => {
            getInvitesForEmailStub.resolves([
                { id: 'invite-1', requestingUserId: INVITER_ID, email: INVITEE.email },
            ]);
            updateInviteStub.rejects(new Error('db write failed'));

            const result = await acceptInvitesOnFirstLogin(HEADERS, INVITEE);

            expect(result.acceptedInviteIds).to.deep.equal([]);
            // Connection creation is independent of the invite-row update
            expect(createUserConnectionStub.calledOnce).to.equal(true);
            expect(result.connectedUserIds).to.deep.equal([INVITER_ID]);
        });
    });

    describe('ensureCompletedUserConnection', () => {
        it('creates a COMPLETE connection when none exists', async () => {
            const connection = await ensureCompletedUserConnection(INVITER_ID, INVITEE.id);

            expect(getUserConnectionsStub.calledOnce).to.equal(true);
            // Reverse lookup must be enabled so an inverted existing row is found
            expect(getUserConnectionsStub.firstCall.args[1]).to.equal(true);
            expect(createUserConnectionStub.calledOnce).to.equal(true);
            expect(connection.requestStatus).to.equal(UserConnectionTypes.COMPLETE);
        });

        it('returns the existing connection untouched when already COMPLETE and unbroken', async () => {
            getUserConnectionsStub.resolves([{
                id: 'existing-connection-id',
                requestingUserId: INVITER_ID,
                acceptingUserId: INVITEE.id,
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: false,
            }]);

            const connection = await ensureCompletedUserConnection(INVITER_ID, INVITEE.id);

            expect(createUserConnectionStub.notCalled).to.equal(true);
            expect(updateUserConnectionStub.notCalled).to.equal(true);
            expect(connection.id).to.equal('existing-connection-id');
        });

        it('repairs a broken connection back to COMPLETE', async () => {
            getUserConnectionsStub.resolves([{
                id: 'existing-connection-id',
                // Stored in the reverse direction — update must use the row's own order
                requestingUserId: INVITEE.id,
                acceptingUserId: INVITER_ID,
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: true,
            }]);

            await ensureCompletedUserConnection(INVITER_ID, INVITEE.id);

            expect(updateUserConnectionStub.calledOnce).to.equal(true);
            expect(updateUserConnectionStub.firstCall.args[0]).to.deep.equal({
                requestingUserId: INVITEE.id,
                acceptingUserId: INVITER_ID,
            });
            expect(updateUserConnectionStub.firstCall.args[1].isConnectionBroken).to.equal(false);
        });

        it('returns null for a self pair or missing ids', async () => {
            expect(await ensureCompletedUserConnection(INVITEE.id, INVITEE.id)).to.equal(null);
            expect(await ensureCompletedUserConnection('', INVITEE.id)).to.equal(null);
            expect(await ensureCompletedUserConnection(INVITER_ID, '')).to.equal(null);
            expect(getUserConnectionsStub.notCalled).to.equal(true);
        });
    });
});
