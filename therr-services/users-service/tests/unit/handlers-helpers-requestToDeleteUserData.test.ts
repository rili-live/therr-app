/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import requestToDeleteUserData from '../../src/handlers/helpers/requestToDeleteUserData';

const HEADERS: any = {
    'x-userid': 'user-1',
    'x-platform': 'mobile',
    'x-brand-variation': 'habits',
    'x-localecode': 'en-us',
};

describe('requestToDeleteUserData', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('fans the deletion out to every service that stores user-keyed data', async () => {
        const requestStub = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ status: 202 } as any);

        const result = await requestToDeleteUserData(HEADERS);

        const urls = requestStub.args.map(([, axiosConfig]) => axiosConfig.url);
        expect(urls).to.have.lengthOf(4);
        expect(urls.some((url) => url?.includes('maps-service') || url?.includes('7773'))).to.be.eq(true);
        expect(urls.some((url) => url?.includes('reactions-service') || url?.includes('7774'))).to.be.eq(true);
        expect(urls.some((url) => url?.includes('messages-service') || url?.includes('7772'))).to.be.eq(true);
        expect(urls.some((url) => url?.includes('websocket-service') || url?.includes('7743'))).to.be.eq(true);
        urls.forEach((url) => expect(url).to.contain('/delete-user-data'));
        requestStub.args.forEach(([, axiosConfig]) => expect(axiosConfig.method).to.equal('delete'));

        expect(result.deletedFrom).to.equal(4);
        expect(result.failedServices).to.deep.equal([]);
    });

    it('forwards the caller headers so each service can identify the user', async () => {
        const requestStub = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ status: 202 } as any);

        await requestToDeleteUserData(HEADERS);

        requestStub.args.forEach(([internalConfig]) => {
            expect(internalConfig.headers['x-userid']).to.equal('user-1');
        });
    });

    // A user is entitled to erasure everywhere it can be performed. One unreachable service
    // must not cancel the others — before this, a single rejection short-circuited Promise.all
    // and left the remaining services' data in place with only a console.log to show for it.
    it('still deletes from the other services when one is unreachable', async () => {
        const requestStub = sinon.stub(internalRestRequestModule, 'internalRestRequest');
        requestStub.onCall(0).rejects(new Error('ECONNREFUSED'));
        requestStub.onCall(1).resolves({ status: 202 } as any);
        requestStub.onCall(2).resolves({ status: 202 } as any);
        requestStub.onCall(3).resolves({ status: 202 } as any);

        const result = await requestToDeleteUserData(HEADERS);

        expect(requestStub.callCount).to.equal(4);
        expect(result.deletedFrom).to.equal(3);
        expect(result.failedServices).to.deep.equal(['maps-service']);
    });

    it('does not reject when every service fails', async () => {
        sinon.stub(internalRestRequestModule, 'internalRestRequest').rejects(new Error('down'));

        const result = await requestToDeleteUserData(HEADERS);

        expect(result.deletedFrom).to.equal(0);
        expect(result.failedServices).to.have.lengthOf(4);
    });
});
