/**
 * handleServiceRequest — which identity reaches the downstream service.
 *
 * Every client also sends its own `x-userid` header (the mobile, web and dashboard
 * interceptors all set it). The gateway used to forward that request header ahead of the
 * value `authenticate` decoded from the JWT, so any signed-in user could act as another
 * account, or claim another account's access levels, by setting the header themselves.
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import handleServiceRequest from '../../../src/middleware/handleServiceRequest';
import * as restRequestModule from '../../../src/utilities/restRequest';

const buildRes = (): any => {
    const res: any = {
        status: () => res,
        send: () => res,
        redirect: () => res,
    };
    return res;
};

describe('handleServiceRequest identity forwarding', () => {
    let sandbox: sinon.SinonSandbox;
    let restRequestStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        restRequestStub = sandbox.stub(restRequestModule, 'default').resolves({ data: {} } as any);
    });

    afterEach(() => {
        sandbox.restore();
    });

    const forwardedHeaders = async (req: any) => {
        const middleware = handleServiceRequest({ basePath: 'http://maps-service:7772', method: 'delete' });
        await middleware({
            url: '/moments/abc', ip: '8.8.8.8', body: {}, ...req,
        }, buildRes());
        return restRequestStub.firstCall.args[0].headers;
    };

    it('forwards the JWT-decoded identity even when the client sends a different one', async () => {
        const headers = await forwardedHeaders({
            headers: {
                'x-userid': 'victim-user-id',
                'x-username': 'victim',
                'x-user-access-levels': '["user.super.admin"]',
                'x-organizations': '{"victim-org":["admin"]}',
            },
            'x-userid': 'signed-in-user-id',
            'x-username': 'signed_in',
            'x-user-access-levels': '["user.default"]',
            'x-organizations': '{}',
        });

        expect(headers['x-userid']).to.equal('signed-in-user-id');
        expect(headers['x-username']).to.equal('signed_in');
        expect(headers['x-user-access-levels']).to.equal('["user.default"]');
        expect(headers['x-organizations']).to.equal('{}');
    });
});
