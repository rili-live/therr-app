import { expect } from 'chai';
import sinon from 'sinon';
import redisClient from '../../../src/store/redisClient';
import UserLocationCache, { USER_CACHE_TTL_SEC } from '../../../src/store/UserLocationCache';

describe('UserLocationCache', () => {
    it('constructor should set a default expire', (done) => {
        const mockUserId = 123;
        const hsetStub = sinon.stub();
        const expireStub = sinon.stub();
        const execStub = sinon.fake.resolves(null);

        const callback = () => {
            expect(hsetStub.calledOnce).to.be.equal(true);
            expect(expireStub.calledOnce).to.be.equal(true);
            expect(expireStub.args[0][0]).to.be.equal(`user:${mockUserId}:nearby-moments`);
            expect(expireStub.args[0][1]).to.be.equal(USER_CACHE_TTL_SEC);
            expect(execStub.calledOnce).to.be.equal(true);
            done();
        };

        redisClient.pipeline = sinon.fake(() => ({
            hset: hsetStub,
            expire: expireStub,
            exec: execStub,
        }));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const userLocationCache = new UserLocationCache(mockUserId, callback);
    });
});
