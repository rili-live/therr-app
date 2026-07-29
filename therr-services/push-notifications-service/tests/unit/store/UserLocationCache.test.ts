import { expect } from 'chai';
import sinon from 'sinon';
import redisClient from '../../../src/store/redisClient';
import UserLocationCache, { DWELLING_CACHE_TTL_SEC, USER_CACHE_TTL_SEC } from '../../../src/store/UserLocationCache';

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

describe('UserLocationCache dwellings', () => {
    const mockUserId = 'user-1';
    const dwellingsKey = `user:${mockUserId}:dwelling-locations`;

    const stubConstructorPipeline = () => {
        (redisClient as any).pipeline = sinon.fake(() => ({
            hset: sinon.stub(),
            expire: sinon.stub(),
            exec: sinon.fake.resolves(null),
        }));
    };

    beforeEach(() => {
        stubConstructorPipeline();
    });

    it('returns undefined on a cache miss so the caller falls back to users-service', async () => {
        (redisClient as any).get = sinon.fake.resolves(null);
        const cache = new UserLocationCache(mockUserId);

        expect(await cache.getDwellings()).to.be.eq(undefined);
    });

    it('distinguishes a cached empty result from a miss', async () => {
        // An empty array is a real answer (most accounts have no qualifying dwelling yet)
        // and must not be retried on every ping.
        (redisClient as any).get = sinon.fake.resolves('[]');
        const cache = new UserLocationCache(mockUserId);

        const result = await cache.getDwellings();

        expect(result).to.be.an('array');
        expect(result).to.have.lengthOf(0);
    });

    it('returns the cached dwelling rows', async () => {
        (redisClient as any).get = sinon.fake.resolves(JSON.stringify([{ id: 'loc-1', latitude: 1, longitude: 2 }]));
        const cache = new UserLocationCache(mockUserId);

        const result = await cache.getDwellings();

        expect(result).to.have.lengthOf(1);
        expect((result as any)[0].id).to.be.eq('loc-1');
    });

    it('treats a corrupt cache entry as a miss rather than throwing', async () => {
        (redisClient as any).get = sinon.fake.resolves('{not json');
        const cache = new UserLocationCache(mockUserId);

        expect(await cache.getDwellings()).to.be.eq(undefined);
    });

    it('treats a redis failure as a miss so an outage never reads as "no dwellings"', async () => {
        (redisClient as any).get = sinon.fake.rejects(new Error('redis down'));
        const cache = new UserLocationCache(mockUserId);

        expect(await cache.getDwellings()).to.be.eq(undefined);
    });

    it('writes dwellings under the dedicated key with the long TTL', async () => {
        const setStub = sinon.fake.resolves('OK');
        (redisClient as any).set = setStub;
        const cache = new UserLocationCache(mockUserId);

        await cache.setDwellings([{ id: 'loc-1' }]);

        expect(setStub.calledOnce).to.be.eq(true);
        expect(setStub.args[0][0]).to.be.eq(dwellingsKey);
        expect(JSON.parse(setStub.args[0][1])).to.have.lengthOf(1);
        expect(setStub.args[0][2]).to.be.eq('EX');
        expect(setStub.args[0][3]).to.be.eq(DWELLING_CACHE_TTL_SEC);
    });

    it('keeps the dwelling key out of the area cache invalidation paths', async () => {
        const delStub = sinon.stub();
        const expireStub = sinon.stub();
        (redisClient as any).pipeline = sinon.fake(() => ({
            hset: sinon.stub(),
            del: delStub,
            expire: expireStub,
            exec: sinon.fake.resolves(null),
        }));
        const cache = new UserLocationCache(mockUserId);

        await cache.clearCache();
        await cache.invalidateCache();

        // Travelling far enough to invalidate nearby areas says nothing about where the
        // user lives, so the dwelling set must survive both paths.
        const touchedKeys = [...delStub.args, ...expireStub.args].map((args) => args[0]);
        expect(touchedKeys).to.not.include(dwellingsKey);
    });
});
