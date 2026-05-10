/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    dispatchPactInvitation,
    generateClaimCode,
    getSmsSender,
    isOnHabits,
} from '../../src/utilities/dispatchPactInvitation';
import { isMatchingInvitee } from '../../src/handlers/helpers/pactRedemption';

describe('Pacts handler — claim flow', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('generateClaimCode (PACT-XXXX format)', () => {
        it('returns a code matching the human-typeable PACT-XXXX format', () => {
            for (let i = 0; i < 50; i += 1) {
                const code = generateClaimCode();
                expect(code).to.match(/^PACT-[2-9A-HJ-NP-Z]{4}$/);
            }
        });

        it('never includes ambiguous chars 0/O/1/I in the random suffix', () => {
            // Sample many codes; we have 50% chance of seeing each char in 20 picks.
            // Across 200 codes (800 chars) the probability of 0/O/1/I appearing
            // by chance is effectively zero — so any hit is a real bug.
            for (let i = 0; i < 200; i += 1) {
                const suffix = generateClaimCode().slice(5);
                expect(suffix).to.not.match(/[01OI]/);
            }
        });
    });

    describe('getSmsSender (Twilio sender routing)', () => {
        const originalGb = process.env.TWILIO_SENDER_PHONE_NUMBER_GB;
        const originalDefault = process.env.TWILIO_SENDER_PHONE_NUMBER;

        before(() => {
            process.env.TWILIO_SENDER_PHONE_NUMBER_GB = '+441234567890';
            process.env.TWILIO_SENDER_PHONE_NUMBER = '+15551234567';
        });

        after(() => {
            // process.env values must be strings; assigning `undefined`
            // stringifies to "undefined" (a truthy string) and leaks into
            // sibling describes — the SMS-fallback test downstream would
            // then call twilioClient.messages.create() and crash on the
            // unconfigured client. Delete instead when originally unset.
            if (originalGb === undefined) {
                delete process.env.TWILIO_SENDER_PHONE_NUMBER_GB;
            } else {
                process.env.TWILIO_SENDER_PHONE_NUMBER_GB = originalGb;
            }
            if (originalDefault === undefined) {
                delete process.env.TWILIO_SENDER_PHONE_NUMBER;
            } else {
                process.env.TWILIO_SENDER_PHONE_NUMBER = originalDefault;
            }
        });

        it('routes UK numbers (+44) through the GB sender', () => {
            expect(getSmsSender('+447700900000')).to.match(/^\+44/);
        });

        it('routes other countries through the default sender', () => {
            expect(getSmsSender('+13175551234')).to.match(/^\+1/);
        });
    });

    describe('isOnHabits (brandVariations JSONB classifier)', () => {
        it('returns true when an active habits entry is present', () => {
            expect(isOnHabits([{ brand: 'habits', isActive: true }])).to.be.eq(true);
        });

        it('returns true when habits entry omits isActive (defaults to active)', () => {
            expect(isOnHabits([{ brand: 'habits' }])).to.be.eq(true);
        });

        it('returns false when habits entry is explicitly inactive', () => {
            expect(isOnHabits([{ brand: 'habits', isActive: false }])).to.be.eq(false);
        });

        it('returns false when the user only has a therr brand entry', () => {
            expect(isOnHabits([{ brand: BrandVariations.THERR, isActive: true }])).to.be.eq(false);
        });

        it('returns false on null / non-array / empty input', () => {
            expect(isOnHabits(null)).to.be.eq(false);
            expect(isOnHabits(undefined)).to.be.eq(false);
            expect(isOnHabits({})).to.be.eq(false);
            expect(isOnHabits([])).to.be.eq(false);
        });
    });

    describe('dispatchPactInvitation', () => {
        const baseArgs = {
            pactMemberId: 'member-1',
            partnerUserId: 'partner-1',
            fromUserName: 'alice',
            habitName: 'Daily run',
            brandVariation: BrandVariations.HABITS,
            whiteLabelOrigin: 'habits.therr.com',
            locale: 'en-us',
        };

        it('short-circuits with isOnBrand=true when the partner is active on Habits', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: 'p@example.com',
                phoneNumber: null,
                brandVariations: [{ brand: 'habits', isActive: true }],
            }]);
            const updateSpy = sinon.spy(Store.pactMembers, 'update');

            const result = await dispatchPactInvitation(baseArgs);

            expect(result.isOnBrand).to.be.eq(true);
            expect(result.claimToken).to.be.eq(undefined);
            expect(updateSpy.called).to.be.eq(false);
        });

        it('mints a token + code and writes them to pact_members for an off-brand partner', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: 'p@example.com',
                phoneNumber: null,
                isUnclaimed: false,
                brandVariations: [{ brand: 'therr', isActive: true }],
            }]);
            const updateStub = sinon.stub(Store.pactMembers, 'update').resolves({} as any);

            const result = await dispatchPactInvitation(baseArgs);

            expect(result.isOnBrand).to.be.eq(false);
            expect(result.claimToken).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            expect(result.claimCode).to.match(/^PACT-[2-9A-HJ-NP-Z]{4}$/);
            expect(result.invitedVia).to.equal('email');
            expect(updateStub.calledOnce).to.be.eq(true);
            const writePayload = updateStub.firstCall.args[1] as any;
            expect(writePayload.claimToken).to.equal(result.claimToken);
            expect(writePayload.claimCode).to.equal(result.claimCode);
            expect(writePayload.invitedVia).to.equal('email');
        });

        it('falls back to invitedVia=sms when the partner has only a phone on file', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: null,
                phoneNumber: '+13175551234',
                isUnclaimed: false,
                brandVariations: [],
            }]);
            sinon.stub(Store.pactMembers, 'update').resolves({} as any);

            const result = await dispatchPactInvitation(baseArgs);

            expect(result.isOnBrand).to.be.eq(false);
            expect(result.invitedVia).to.equal('sms');
        });

        it('skips dispatch entirely when the partner has neither email nor phone', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: null,
                phoneNumber: null,
                isUnclaimed: false,
                brandVariations: [],
            }]);
            const updateSpy = sinon.spy(Store.pactMembers, 'update');

            const result = await dispatchPactInvitation(baseArgs);

            expect(result.isOnBrand).to.be.eq(false);
            expect(result.claimToken).to.be.eq(undefined);
            expect(updateSpy.called).to.be.eq(false);
        });

        it('treats an isUnclaimed user as having no email (placeholder accounts get skipped)', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: 'placeholder@example.com',
                phoneNumber: null,
                isUnclaimed: true,
                brandVariations: [],
            }]);
            const updateSpy = sinon.spy(Store.pactMembers, 'update');

            const result = await dispatchPactInvitation(baseArgs);

            expect(result.isOnBrand).to.be.eq(false);
            expect(updateSpy.called).to.be.eq(false);
        });

        it('returns isOnBrand=false (silent) when the partner cannot be found', async () => {
            sinon.stub(Store.users, 'findUser').resolves([]);
            const updateSpy = sinon.spy(Store.pactMembers, 'update');

            const result = await dispatchPactInvitation(baseArgs);

            expect(result.isOnBrand).to.be.eq(false);
            expect(updateSpy.called).to.be.eq(false);
        });

        it('retries on a unique-violation collision and persists on the next attempt', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: 'p@example.com',
                phoneNumber: null,
                isUnclaimed: false,
                brandVariations: [],
            }]);
            const collisionErr: any = new Error('duplicate key value violates unique constraint');
            collisionErr.code = '23505';
            const updateStub = sinon.stub(Store.pactMembers, 'update');
            updateStub.onFirstCall().rejects(collisionErr);
            updateStub.onSecondCall().resolves({} as any);

            const result = await dispatchPactInvitation(baseArgs);

            expect(updateStub.callCount).to.equal(2);
            expect(result.claimCode).to.match(/^PACT-[2-9A-HJ-NP-Z]{4}$/);
            // The two attempts use different codes (extremely high probability)
            const firstCode = (updateStub.firstCall.args[1] as any).claimCode;
            const secondCode = (updateStub.secondCall.args[1] as any).claimCode;
            expect(firstCode).to.not.equal(secondCode);
        });

        it('falls back to a token-only invite when all collision retries are exhausted', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: 'p@example.com',
                phoneNumber: null,
                isUnclaimed: false,
                brandVariations: [],
            }]);
            const collisionErr: any = new Error('duplicate');
            collisionErr.code = '23505';
            const updateStub = sinon.stub(Store.pactMembers, 'update');
            // Five sequential collisions exhaust the retry budget; the sixth call
            // is the fallback that writes claimCode=null.
            for (let i = 0; i < 5; i += 1) updateStub.onCall(i).rejects(collisionErr);
            updateStub.onCall(5).resolves({} as any);

            await dispatchPactInvitation(baseArgs);

            expect(updateStub.callCount).to.equal(6);
            const fallbackPayload = updateStub.lastCall.args[1] as any;
            expect(fallbackPayload.claimCode).to.be.eq(null);
            expect(fallbackPayload.claimToken).to.be.a('string');
        });

        it('rethrows non-collision DB errors instead of looping', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                id: 'partner-1',
                email: 'p@example.com',
                phoneNumber: null,
                isUnclaimed: false,
                brandVariations: [],
            }]);
            const fatalErr: any = new Error('connection refused');
            fatalErr.code = '08006';
            const updateStub = sinon.stub(Store.pactMembers, 'update').rejects(fatalErr);

            let caught: any;
            try {
                await dispatchPactInvitation(baseArgs);
            } catch (err) {
                caught = err;
            }

            expect(caught).to.equal(fatalErr);
            expect(updateStub.callCount).to.equal(1);
        });
    });
});

describe('Pacts handler — PACT-XXXX redemption identity check (isMatchingInvitee)', () => {
    it('matches when normalized emails are equal', () => {
        const result = isMatchingInvitee(
            { email: 'Test.User@Gmail.com' },
            { email: 'testuser@gmail.com' },
        );
        expect(result).to.be.eq(true);
    });

    it('matches when phone numbers are equal after normalization', () => {
        const result = isMatchingInvitee(
            { phoneNumber: '317-555-1234' },
            { phoneNumber: '+13175551234' },
        );
        expect(result).to.be.eq(true);
    });

    it('matches when only one channel agrees (email matches, phone differs)', () => {
        const result = isMatchingInvitee(
            { email: 'a@b.com', phoneNumber: '+15555551111' },
            { email: 'a@b.com', phoneNumber: '+15555552222' },
        );
        expect(result).to.be.eq(true);
    });

    it('rejects when neither email nor phone match', () => {
        const result = isMatchingInvitee(
            { email: 'attacker@evil.com', phoneNumber: '+15555550000' },
            { email: 'invitee@friends.com', phoneNumber: '+15555559999' },
        );
        expect(result).to.be.eq(false);
    });

    it('rejects when invitee has no contact info on file', () => {
        const result = isMatchingInvitee(
            { email: 'a@b.com' },
            { email: null, phoneNumber: null },
        );
        expect(result).to.be.eq(false);
    });

    it('rejects when registrant has no contact info', () => {
        const result = isMatchingInvitee(
            {},
            { email: 'a@b.com' },
        );
        expect(result).to.be.eq(false);
    });

    it('rejects when both sides have only blank strings (not falsely "matching")', () => {
        const result = isMatchingInvitee(
            { email: '', phoneNumber: '' },
            { email: '', phoneNumber: '' },
        );
        expect(result).to.be.eq(false);
    });

    it('handles invalid phone strings gracefully (does not throw)', () => {
        expect(() => isMatchingInvitee(
            { phoneNumber: 'not-a-phone' },
            { phoneNumber: 'also-not' },
        )).to.not.throw();
    });
});

describe('Pacts handler — claimPactInvite endpoint', () => {
    let claimPactInvite: any;

    before(async () => {
        // Reach into the module after stubbing acceptPact so claimPactInvite's
        // internal reference resolves to the stub. The handler captures
        // acceptPact via a top-level const so the stub must be set before
        // the test calls claimPactInvite.
        const handlersModule: any = await import('../../src/handlers/pacts');
        claimPactInvite = handlersModule.claimPactInvite;
    });

    afterEach(() => {
        sinon.restore();
    });

    const buildRes = () => {
        const res: any = {};
        res.status = sinon.stub().returns(res);
        res.send = sinon.stub().returns(res);
        return res;
    };

    const buildReq = (body: any, userId = 'caller-1') => ({
        headers: {
            'x-userid': userId,
            'x-username': 'caller',
            'x-localecode': 'en-us',
        },
        body,
        params: {},
    });

    it('returns 400 when neither token nor code is supplied', async () => {
        const req = buildReq({});
        const res = buildRes();
        await claimPactInvite(req, res);
        expect(res.status.firstCall.args[0]).to.equal(400);
    });

    it('returns 404 when no pact_members row matches the supplied claim', async () => {
        sinon.stub(Store.pactMembers, 'findByClaim').resolves(undefined);

        const req = buildReq({ token: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' });
        const res = buildRes();
        await claimPactInvite(req, res);

        expect(res.status.firstCall.args[0]).to.equal(404);
    });

    it('returns 403 when the caller is not the pact_members.userId on the row', async () => {
        sinon.stub(Store.pactMembers, 'findByClaim').resolves({
            id: 'm-1',
            pactId: 'p-1',
            userId: 'another-user',
            status: 'pending',
            claimTokenExpiresAt: new Date(Date.now() + 60_000),
        });

        const req = buildReq({ code: 'PACT-AAAA' }, 'caller-1');
        const res = buildRes();
        await claimPactInvite(req, res);

        expect(res.status.firstCall.args[0]).to.equal(403);
    });

    it('returns 410 when claimTokenExpiresAt is in the past', async () => {
        sinon.stub(Store.pactMembers, 'findByClaim').resolves({
            id: 'm-1',
            pactId: 'p-1',
            userId: 'caller-1',
            status: 'pending',
            claimTokenExpiresAt: new Date(Date.now() - 60_000),
        });

        const req = buildReq({ code: 'PACT-AAAA' });
        const res = buildRes();
        await claimPactInvite(req, res);

        expect(res.status.firstCall.args[0]).to.equal(410);
    });

    it('is idempotent and returns 200 with the pact when the member is already active', async () => {
        sinon.stub(Store.pactMembers, 'findByClaim').resolves({
            id: 'm-1',
            pactId: 'p-1',
            userId: 'caller-1',
            status: 'active',
            claimTokenExpiresAt: null,
        });
        sinon.stub(Store.pacts, 'getByIdWithDetails').resolves({ id: 'p-1', status: 'active' });

        const req = buildReq({ code: 'PACT-AAAA' });
        const res = buildRes();
        await claimPactInvite(req, res);

        expect(res.status.firstCall.args[0]).to.equal(200);
        expect(res.send.firstCall.args[0]).to.deep.include({ id: 'p-1' });
    });

    it('returns 400 when the row is in an unredeemable state (left/declined)', async () => {
        sinon.stub(Store.pactMembers, 'findByClaim').resolves({
            id: 'm-1',
            pactId: 'p-1',
            userId: 'caller-1',
            status: 'left',
            claimTokenExpiresAt: null,
        });

        const req = buildReq({ code: 'PACT-AAAA' });
        const res = buildRes();
        await claimPactInvite(req, res);

        expect(res.status.firstCall.args[0]).to.equal(400);
    });

    it('passes the claim through to acceptPact when the row is pending and unexpired', async () => {
        sinon.stub(Store.pactMembers, 'findByClaim').resolves({
            id: 'm-1',
            pactId: 'pact-42',
            userId: 'caller-1',
            status: 'pending',
            claimTokenExpiresAt: new Date(Date.now() + 60_000),
        });

        // We can't easily stub acceptPact (it's a top-level const reference),
        // but we can stub the Store calls it makes so the delegation completes
        // without exploding. The assertion is that res.status(200) is reached
        // without any 4xx short-circuit.
        sinon.stub(Store.pacts, 'getById').resolves({
            id: 'pact-42',
            status: 'pending',
            creatorUserId: 'creator',
            partnerUserId: 'caller-1',
            habitGoalId: 'g-1',
            durationDays: 30,
        });
        sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves({
            role: 'partner',
            status: 'pending',
        });
        sinon.stub(Store.pacts, 'activate').resolves({ id: 'pact-42', status: 'active' });
        sinon.stub(Store.pactMembers, 'activate').resolves({} as any);
        sinon.stub(Store.streaks, 'getOrCreate').resolves({} as any);

        const req = buildReq({ token: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' });
        const res = buildRes();
        await claimPactInvite(req, res);

        expect(res.status.firstCall.args[0]).to.equal(200);
    });
});
