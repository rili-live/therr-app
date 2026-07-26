/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { incrementUserInterests } from '../../src/handlers/userInterests';

describe('User Interests Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    const buildRes = () => {
        const res: any = {};
        res.statusCode = null;
        res.body = null;
        res.status = (code: number) => {
            res.statusCode = code;
            return res;
        };
        res.send = (body: any) => {
            res.body = body;
            return res;
        };
        return res;
    };

    const buildReq = (body: any) => ({
        headers: {
            'x-userid': '11111111-1111-1111-1111-111111111111',
            'x-localecode': 'en-us',
        },
        body,
    });

    describe('incrementUserInterests', () => {
        it('routes the coalesced payload to the per-key increment', async () => {
            const byKeyStub = sinon.stub(Store.userInterests, 'incrementUserInterestsByKey').resolves([{ id: 'ui-1' }]);
            const legacyStub = sinon.stub(Store.userInterests, 'incrementUserInterests').resolves([]);

            await incrementUserInterests(buildReq({
                interestIncrements: {
                    'interests.foodDrink.coffee': 6,
                    'interests.sports.soccer': 2,
                },
            }), buildRes());

            expect(legacyStub.called).to.be.eq(false);
            expect(byKeyStub.calledOnce).to.be.eq(true);
            expect(byKeyStub.args[0][0]).to.eq('11111111-1111-1111-1111-111111111111');
            expect(byKeyStub.args[0][1]).to.deep.equal({
                'interests.foodDrink.coffee': 6,
                'interests.sports.soccer': 2,
            });
        });

        it('caps how much a single flush can add to one interest', async () => {
            const byKeyStub = sinon.stub(Store.userInterests, 'incrementUserInterestsByKey').resolves([]);

            await incrementUserInterests(buildReq({
                interestIncrements: { 'interests.foodDrink.coffee': 5000 },
            }), buildRes());

            expect(byKeyStub.args[0][1]).to.deep.equal({ 'interests.foodDrink.coffee': 25 });
        });

        // A rolling deploy leaves older maps/reactions pods sending the one-event-at-a-time
        // shape for a while. Dropping it would silently stop preference learning mid-deploy.
        it('still accepts the legacy single-increment payload', async () => {
            const byKeyStub = sinon.stub(Store.userInterests, 'incrementUserInterestsByKey').resolves([]);
            const legacyStub = sinon.stub(Store.userInterests, 'incrementUserInterests').resolves([{ id: 'ui-1' }]);

            await incrementUserInterests(buildReq({
                interestDisplayNameKeys: ['interests.foodDrink.coffee'],
                incrBy: 3,
            }), buildRes());

            expect(byKeyStub.called).to.be.eq(false);
            expect(legacyStub.calledOnce).to.be.eq(true);
            expect(legacyStub.args[0][1]).to.deep.equal(['interests.foodDrink.coffee']);
            expect(legacyStub.args[0][2]).to.eq(3);
        });

        // An array passes `typeof === 'object'`, so without an explicit guard it would take
        // the coalesced branch and key increments by numeric index — matching no interest at
        // all, so the request would 200 having recorded nothing.
        it('does not treat an array payload as the coalesced shape', async () => {
            const byKeyStub = sinon.stub(Store.userInterests, 'incrementUserInterestsByKey').resolves([]);
            const legacyStub = sinon.stub(Store.userInterests, 'incrementUserInterests').resolves([{ id: 'ui-1' }]);

            await incrementUserInterests(buildReq({
                interestIncrements: ['interests.foodDrink.coffee'],
                interestDisplayNameKeys: ['interests.foodDrink.coffee'],
                incrBy: 2,
            }), buildRes());

            expect(byKeyStub.called).to.be.eq(false);
            expect(legacyStub.calledOnce).to.be.eq(true);
        });

        // The store only updates interests the user already declared, so a flush can
        // legitimately match zero rows. `res.send(undefined)` would answer 200 with no body.
        it('answers with a body when the flush matched no declared interest', async () => {
            sinon.stub(Store.userInterests, 'incrementUserInterestsByKey').resolves([]);
            const res = buildRes();

            await incrementUserInterests(buildReq({
                interestIncrements: { 'interests.notDeclared': 3 },
            }), res);

            expect(res.statusCode).to.eq(200);
            expect(res.body).to.deep.equal({});
        });

        it('returns early without touching the store when there is no user', async () => {
            const byKeyStub = sinon.stub(Store.userInterests, 'incrementUserInterestsByKey').resolves([]);
            const legacyStub = sinon.stub(Store.userInterests, 'incrementUserInterests').resolves([]);
            const res = buildRes();

            await incrementUserInterests({
                headers: { 'x-localecode': 'en-us' },
                body: { interestIncrements: { 'interests.foodDrink.coffee': 1 } },
            }, res);

            expect(res.statusCode).to.eq(200);
            expect(byKeyStub.called).to.be.eq(false);
            expect(legacyStub.called).to.be.eq(false);
        });
    });
});
