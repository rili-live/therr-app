/**
 * Error forwarding through the service proxy, driven against the real
 * middleware rather than a re-implementation of its logic.
 *
 * The sibling suite (`handleServiceRequest.test.ts`) asserts on inline copies
 * of the source's expressions, which cannot catch a defect in the source: it
 * happily encoded `error.response.data.statusCode || 500` as correct while
 * that line was turning every Friends with Habits gate into a 500. So this
 * file stubs `restRequest` and asserts on what the client actually receives.
 *
 * WHAT BROKE
 *
 * The gateway derived the client-facing status from the upstream *body*, not
 * from the upstream HTTP status. Handlers that answer through
 * `handleHttpError` echo the status into the body, so they were unaffected.
 * Handlers that call `res.status(x).send({ ... })` directly send no
 * `statusCode` key — and every habits gate does: 402 `habit-limit-reached`,
 * 403 `solo-locked`, 409 on a purchase conflict. All of them arrived at the
 * client as a 500 with the paywall metadata stripped, so mobile fell through
 * to a generic "We could not start that habit." toast and the upgrade offer
 * was unreachable.
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import handleServiceRequest from '../../../src/middleware/handleServiceRequest';
import * as restRequestModule from '../../../src/utilities/restRequest';

interface ICapturedResponse {
    statusCode?: number;
    body?: any;
}

/** A minimal express `res` double plus the payload it ends up holding. */
const buildRes = (): { res: any; captured: ICapturedResponse } => {
    const captured: ICapturedResponse = {};
    const res: any = {
        status: (code: number) => {
            captured.statusCode = code;
            return res;
        },
        send: (body: any) => {
            captured.body = body;
            return res;
        },
        redirect: (url: string) => {
            captured.body = { redirectUrl: url };
            return res;
        },
    };

    return { res, captured };
};

const buildReq = (body?: any) => ({
    headers: {},
    url: '/habits/user-habits',
    ip: '8.8.8.8',
    body: body || {},
});

/** An axios-shaped rejection: a real HTTP status plus the upstream's body. */
const upstreamError = (status: number, data: any) => Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data },
});

describe('handleServiceRequest error forwarding', () => {
    let sandbox: sinon.SinonSandbox;
    let restRequestStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        restRequestStub = sandbox.stub(restRequestModule, 'default');
    });

    afterEach(() => {
        sandbox.restore();
    });

    const proxy = (error: any) => {
        restRequestStub.rejects(error);
        const { res, captured } = buildRes();
        const middleware = handleServiceRequest({ basePath: 'http://users-service:7771', method: 'post' });

        return Promise.resolve(middleware(buildReq(), res)).then(() => captured);
    };

    describe('a gate that answers with res.status().send() and no statusCode in the body', () => {
        // The exact payload `checkHabitCapacity` returns.
        const habitLimitDenial = {
            error: 'habit-limit-reached',
            message: 'Free accounts can track 5 habits at a time. Archive one, or unlock everything for life.',
            limit: 5,
            activeHabitCount: 5,
            upgradeRequired: true,
        };

        it('forwards the 402 rather than collapsing it to a 500', async () => {
            const captured = await proxy(upstreamError(402, habitLimitDenial));

            expect(captured.statusCode).to.equal(402);
        });

        it('keeps the discriminator and the limit the paywall route reads', async () => {
            const captured = await proxy(upstreamError(402, habitLimitDenial));

            // Mobile routes on `data.error` and renders `data.limit`; dropping
            // either one is what made the upgrade offer unreachable.
            expect(captured.body.error).to.equal('habit-limit-reached');
            expect(captured.body.limit).to.equal(5);
            expect(captured.body.activeHabitCount).to.equal(5);
            expect(captured.body.upgradeRequired).to.be.eq(true);
            expect(captured.body.message).to.contain('Free accounts can track 5 habits');
        });

        it('forwards a 403 solo-lock with the invite progress attached', async () => {
            const captured = await proxy(upstreamError(403, {
                error: 'solo-locked',
                message: 'Invite 1 more friend to unlock solo habits',
                invitedCount: 2,
                requiredCount: 3,
            }));

            expect(captured.statusCode).to.equal(403);
            expect(captured.body.error).to.equal('solo-locked');
            expect(captured.body.invitedCount).to.equal(2);
            expect(captured.body.requiredCount).to.equal(3);
        });

        it('forwards a 409 purchase conflict', async () => {
            const captured = await proxy(upstreamError(409, {
                error: 'purchase-already-claimed',
                message: 'That purchase is already linked to another account.',
            }));

            expect(captured.statusCode).to.equal(409);
            expect(captured.body.error).to.equal('purchase-already-claimed');
        });
    });

    describe('handlers that answer through handleHttpError', () => {
        it('still forwards the status, which the body echoes', async () => {
            const captured = await proxy(upstreamError(404, {
                statusCode: 404,
                message: 'Habit goal not found',
                errorCode: 'UNKNOWN_ERROR',
            }));

            expect(captured.statusCode).to.equal(404);
            expect(captured.body.message).to.equal('Habit goal not found');
            expect(captured.body.errorCode).to.equal('UNKNOWN_ERROR');
        });
    });

    describe('errors with no usable upstream response', () => {
        it('falls back to 500 when the service could not be reached', async () => {
            const captured = await proxy(new Error('connect ECONNREFUSED 127.0.0.1:7771'));

            expect(captured.statusCode).to.equal(500);
        });

        it('does not spread a non-object body onto the response', async () => {
            // An ingress or sidecar can answer with an HTML error page. Spreading
            // a string would emit one numeric key per character.
            const captured = await proxy(upstreamError(502, '<html><body>Bad Gateway</body></html>'));

            expect(captured.statusCode).to.equal(502);
            expect(captured.body).to.not.have.property('0');
            expect(captured.body.message).to.be.a('string');
        });
    });
});
