import { expect } from 'chai';
import sinon from 'sinon';
import { Notifications, UserConnectionTypes } from 'therr-js-utilities/constants';
import * as restRequestModule from '../../../src/utilities/restRequest';
import redisSessions from '../../../src/store/redisSessions';
import { updateConnection } from '../../../src/handlers/userConnections';

/**
 * An unconnect PUTs `{ isConnectionBroken: true, otherUserId }` with no `requestStatus`
 * (see TherrMobile ViewUser 'remove-connection-request'). Knex omits undefined values from
 * the SET clause, so users-service leaves the column alone and returns the row still
 * holding `requestStatus: 'complete'`. Any check that reads the status without the broken
 * flag therefore treats a removal as an acceptance.
 */
const unconnectedRow = {
    id: 'connection-123',
    requestingUserId: 'requester-456',
    acceptingUserId: 'accepter-789',
    requestStatus: UserConnectionTypes.COMPLETE,
    isConnectionBroken: true,
};

const acceptedRow = {
    ...unconnectedRow,
    isConnectionBroken: false,
};

describe('websocket handlers/userConnections updateConnection', () => {
    let sandbox: sinon.SinonSandbox;
    let restRequestStub: sinon.SinonStub;

    const notificationCalls = () => restRequestStub.getCalls()
        .filter((call) => String(call.args[1]?.url || '').includes('/users/notifications'));

    const runUpdateFor = async (connectionRow: any) => {
        restRequestStub.callsFake((_config: any, options: any) => {
            if (String(options?.url || '').includes('/users/connections')) {
                return Promise.resolve({ data: connectionRow });
            }

            return Promise.resolve({ data: { id: 'notification-1' } });
        });

        const socket: any = {
            id: 'socket-abc',
            to: sandbox.stub().returns({ emit: sandbox.spy() }),
            emit: sandbox.spy(),
        };

        await updateConnection({} as any, socket, {
            connection: {
                isConnectionBroken: connectionRow.isConnectionBroken,
                otherUserId: connectionRow.requestingUserId,
            },
            user: { id: connectionRow.acceptingUserId, userName: 'accepter' },
        }, {});
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        restRequestStub = sandbox.stub(restRequestModule, 'default');
        // Both parties offline — keeps these cases on the notification path, which is the
        // one that had no isConnectionBroken guard.
        sandbox.stub(redisSessions, 'getUserById').resolves({ socketId: null } as any);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('does not notify the other party that a request was accepted when the connection was removed', async () => {
        await runUpdateFor(unconnectedRow);

        expect(notificationCalls()).to.have.lengthOf(0);
    });

    it('still notifies the other party when a request is genuinely accepted', async () => {
        await runUpdateFor(acceptedRow);

        const calls = notificationCalls();

        expect(calls).to.have.lengthOf(1);
        expect(calls[0].args[1].data.type).to.equal(Notifications.Types.CONNECTION_REQUEST_ACCEPTED);
        expect(calls[0].args[1].data.userId).to.equal(acceptedRow.requestingUserId);
    });
});
