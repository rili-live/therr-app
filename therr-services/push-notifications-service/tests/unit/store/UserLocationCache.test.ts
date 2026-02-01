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
            expect(hsetStub.calledTwice).to.be.equal(true);
            expect(expireStub.calledTwice).to.be.equal(true);
            expect(expireStub.args[0][0]).to.be.equal(`user:${mockUserId}:nearby-moments`);
            expect(expireStub.args[0][1]).to.be.equal(USER_CACHE_TTL_SEC);
            expect(expireStub.args[1][0]).to.be.equal(`user:${mockUserId}:nearby-spaces`);
            expect(expireStub.args[1][1]).to.be.equal(USER_CACHE_TTL_SEC);
            expect(execStub.calledOnce).to.be.equal(true);
            done();
        };

        (redisClient as any).pipeline = sinon.fake(() => ({
            hset: hsetStub,
            expire: expireStub,
            exec: execStub,
        }));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const userLocationCache = new UserLocationCache(mockUserId, callback);
    });

    it('getMomentsWithinDistance returns a properly mapped/parsed array of moments', async () => {
        const mockUserId = 123;
        const mockRedisMoments = [
            {
                id: '6f6589c7-5057-4eea-8053-3d8622f56eb3',
                fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                isPublic: 'false',
                maxViews: '0',
                latitude: '-123.45345',
                longitude: '123.34234',
                radius: '50',
                maxProximity: '10',
                doesRequireProximityToView: 'true',
            },
            {
                id: '4f459cf9-42bb-4ab2-9b0d-ea6c967c77c5',
                fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                maxViews: '0',
                latitude: '-123.45345',
                longitude: '123.34234',
                radius: '50',
                maxProximity: '10',
            },
            {
                id: '4476e10e-ebaf-41ed-ab8e-4144405b4f23',
                fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                isPublic: 'yes',
                maxViews: '0',
                latitude: '-123.45345',
                longitude: '123.34234',
                radius: 0,
                maxProximity: null,
                doesRequireProximityToView: 'true',
            },
        ];
        const mockMomentIds = [mockRedisMoments[0].id, mockRedisMoments[1].id, mockRedisMoments[2].id];
        const hsetStub = sinon.stub();
        const hgetallStub = sinon.stub();
        const expireStub = sinon.stub();
        const georadiusStub = sinon.fake.resolves(mockMomentIds);
        const execStub = sinon.fake.resolves([[null, mockRedisMoments[0]], [null, mockRedisMoments[1]], [null, mockRedisMoments[2]]]);

        redisClient.sendCommand = georadiusStub;

        (redisClient as any).pipeline = sinon.fake(() => ({
            hset: hsetStub,
            hgetall: hgetallStub,
            georadius: georadiusStub,
            expire: expireStub,
            exec: execStub,
        }));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const userLocationCache = new UserLocationCache(mockUserId);

        await userLocationCache.getMomentsWithinDistance({}, 100, {})
            .then((response: any) => {
                expect(response[0]).to.be.deep.equal({
                    id: '6f6589c7-5057-4eea-8053-3d8622f56eb3',
                    fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                    isPublic: false,
                    maxViews: 0,
                    latitude: -123.45345,
                    longitude: 123.34234,
                    radius: 50,
                    maxProximity: 10,
                    doesRequireProximityToView: true,
                });
                expect(response[1]).to.be.deep.equal({
                    id: '4f459cf9-42bb-4ab2-9b0d-ea6c967c77c5',
                    fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                    isPublic: false,
                    maxViews: 0,
                    latitude: -123.45345,
                    longitude: 123.34234,
                    radius: 50,
                    maxProximity: 10,
                    doesRequireProximityToView: false,
                });
                expect(response[2]).to.be.deep.equal({
                    id: '4476e10e-ebaf-41ed-ab8e-4144405b4f23',
                    fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                    isPublic: false,
                    maxViews: 0,
                    latitude: -123.45345,
                    longitude: 123.34234,
                    radius: 0,
                    maxProximity: 0,
                    doesRequireProximityToView: true,
                });
            });
    });

    it('getSpacesWithinDistance returns a properly mapped/parsed array of spaces', async () => {
        const mockUserId = 123;
        const mockRedisSpaces = [
            {
                id: '6f6589c7-5057-4eea-8053-3d8622f56eb3',
                fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                isPublic: 'false',
                maxViews: '0',
                latitude: '-123.45345',
                longitude: '123.34234',
                radius: '50',
                maxProximity: '10',
                doesRequireProximityToView: 'true',
            },
            {
                id: '4f459cf9-42bb-4ab2-9b0d-ea6c967c77c5',
                fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                maxViews: '0',
                latitude: '-123.45345',
                longitude: '123.34234',
                radius: '50',
                maxProximity: '10',
            },
            {
                id: '4476e10e-ebaf-41ed-ab8e-4144405b4f23',
                fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                isPublic: 'yes',
                maxViews: '0',
                latitude: '-123.45345',
                longitude: '123.34234',
                radius: 0,
                maxProximity: null,
                doesRequireProximityToView: 'true',
            },
        ];
        const mockSpaceIds = [mockRedisSpaces[0].id, mockRedisSpaces[1].id, mockRedisSpaces[2].id];
        const hsetStub = sinon.stub();
        const hgetallStub = sinon.stub();
        const expireStub = sinon.stub();
        const georadiusStub = sinon.fake.resolves(mockSpaceIds);
        const execStub = sinon.fake.resolves([[null, mockRedisSpaces[0]], [null, mockRedisSpaces[1]], [null, mockRedisSpaces[2]]]);

        redisClient.sendCommand = georadiusStub;

        (redisClient as any).pipeline = sinon.fake(() => ({
            hset: hsetStub,
            hgetall: hgetallStub,
            georadius: georadiusStub,
            expire: expireStub,
            exec: execStub,
        }));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const userLocationCache = new UserLocationCache(mockUserId);

        await userLocationCache.getSpacesWithinDistance({}, 100, {})
            .then((response: any) => {
                expect(response[0]).to.be.deep.equal({
                    id: '6f6589c7-5057-4eea-8053-3d8622f56eb3',
                    fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                    isPublic: false,
                    maxViews: 0,
                    latitude: -123.45345,
                    longitude: 123.34234,
                    radius: 50,
                    maxProximity: 10,
                    doesRequireProximityToView: true,
                });
                expect(response[1]).to.be.deep.equal({
                    id: '4f459cf9-42bb-4ab2-9b0d-ea6c967c77c5',
                    fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                    isPublic: false,
                    maxViews: 0,
                    latitude: -123.45345,
                    longitude: 123.34234,
                    radius: 50,
                    maxProximity: 10,
                    doesRequireProximityToView: false,
                });
                expect(response[2]).to.be.deep.equal({
                    id: '4476e10e-ebaf-41ed-ab8e-4144405b4f23',
                    fromUserId: '0cbf27f3-b766-4e96-a9a7-0feb880f9366',
                    isPublic: false,
                    maxViews: 0,
                    latitude: -123.45345,
                    longitude: 123.34234,
                    radius: 0,
                    maxProximity: 0,
                    doesRequireProximityToView: true,
                });
            });
    });
});
