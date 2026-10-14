import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import * as sendEmailAndOrPushModule from '../../src/utilities/sendEmailAndOrPushNotification';
import { abandonPact } from '../../src/handlers/pacts';

/**
 * `POST /habits/pacts/:id/abandon`.
 *
 * Two regressions:
 *
 *   - Abandoning deactivated every streak row linked to the pact, the partner's included.
 *     `habits.streaks` is one row per (user, habit) that carries across pacts, and nothing ever
 *     re-activated it — so the partner, who did nothing, silently lost that habit's freezes from
 *     their daily streak, its entry in /streaks/active and the digest's at-risk warning.
 *   - A group pact has no `partnerUserId`, so authorizing on the 1:1 columns alone answered
 *     403 to every group member who tried to leave.
 */

const CREATOR = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PARTNER = 'bbbbbbbb-0000-4000-8000-00000000000b';
const GROUP_MEMBER = 'cccccccc-0000-4000-8000-00000000000c';
const STRANGER = 'dddddddd-0000-4000-8000-00000000000d';
const PACT_ID = 'eeeeeeee-0000-4000-8000-00000000000e';

const buildRes = () => {
    const captured: { statusCode?: number; body?: any } = {};
    return {
        captured,
        res: {
            status: (statusCode: number) => {
                captured.statusCode = statusCode;
                return { send: (payload: any) => { captured.body = payload; return payload; } };
            },
        } as any,
    };
};

const callHandler = async (userId: string) => {
    const { captured, res } = buildRes();
    await abandonPact({
        headers: { 'x-userid': userId, 'x-localecode': 'en-us', 'x-brand-variation': BrandVariations.HABITS },
        params: { id: PACT_ID },
    } as any, res, (() => undefined) as any);
    return captured;
};

describe('abandonPact', () => {
    let abandon: sinon.SinonStub;
    let leave: sinon.SinonStub;
    let getByPactAndUser: sinon.SinonStub;
    let deactivate: sinon.SinonStub;

    const stubPact = (pact: Record<string, any>) => {
        sinon.stub(Store.pacts, 'getById').resolves({
            id: PACT_ID, creatorUserId: CREATOR, status: 'active', ...pact,
        } as any);
    };

    beforeEach(() => {
        abandon = sinon.stub(Store.pacts, 'abandon').resolves({ id: PACT_ID, status: 'abandoned' } as any);
        leave = sinon.stub(Store.pactMembers, 'leave').resolves({} as any);
        getByPactAndUser = sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(undefined);
        sinon.stub(Store.streaks, 'getByPactId').resolves([{ id: 'streak-partner', userId: PARTNER }] as any);
        deactivate = sinon.stub(Store.streaks, 'deactivate').resolves({} as any);
        // Notifications are fire-and-forget; an empty lookup ends them without a send.
        sinon.stub(Store.users, 'findUser').resolves([] as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('ends a 1:1 pact without deactivating anyone\'s per-habit streak', async () => {
        stubPact({ partnerUserId: PARTNER });

        const captured = await callHandler(CREATOR);

        expect(captured.statusCode).to.equal(200);
        expect(abandon.calledOnceWith(PACT_ID, CREATOR, true)).to.equal(true);
        expect(leave.calledOnceWith(PACT_ID, CREATOR)).to.equal(true);
        expect(deactivate.called, 'deactivated a streak that carries across pacts').to.equal(false);
    });

    it('lets an active group member leave without ending the pact for everyone else', async () => {
        stubPact({ partnerUserId: null });
        getByPactAndUser.resolves({
            id: 'member-3', userId: GROUP_MEMBER, role: 'partner', status: 'active',
        });

        const captured = await callHandler(GROUP_MEMBER);

        expect(captured.statusCode).to.equal(200);
        expect(leave.calledOnceWith(PACT_ID, GROUP_MEMBER)).to.equal(true);
        expect(abandon.called, 'ended the pact for the remaining members').to.equal(false);
        expect(deactivate.called).to.equal(false);
    });

    it('tells the creator a member left, rather than that the pact was declined', async () => {
        stubPact({ partnerUserId: null });
        getByPactAndUser.resolves({
            id: 'member-3', userId: GROUP_MEMBER, role: 'partner', status: 'active',
        });
        const push = sinon.stub(sendEmailAndOrPushModule, 'default').resolves({} as any);

        await callHandler(GROUP_MEMBER);

        expect(push.callCount).to.equal(1);
        // Same type, so installed apps keep its tap route; the reason only selects the copy.
        expect(push.firstCall.args[2]).to.include({
            toUserId: CREATOR,
            type: PushNotifications.Types.pactDeclined,
            pactDeclineReason: 'memberLeft',
        });
    });

    it('still refuses someone with no active membership', async () => {
        stubPact({ partnerUserId: null });
        getByPactAndUser.resolves({
            id: 'member-4', userId: STRANGER, role: 'partner', status: 'left',
        });

        const captured = await callHandler(STRANGER);

        expect(captured.statusCode).to.equal(403);
        expect(leave.called).to.equal(false);
        expect(abandon.called).to.equal(false);
    });

    it('still refuses a pact that is not active', async () => {
        stubPact({ partnerUserId: PARTNER, status: 'pending' });

        const captured = await callHandler(PARTNER);

        expect(captured.statusCode).to.equal(400);
        expect(abandon.called).to.equal(false);
    });
});
