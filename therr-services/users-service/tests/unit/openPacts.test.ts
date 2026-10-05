import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import * as sendEmailModule from '../../src/api/email/sendEmail';
import {
    getHabitMatchKey,
    isPactJoinable,
    normalizeHabitName,
    openPactSuggestionDedupeKey,
} from '../../src/utilities/openPacts';
import { runOpenPactSuggestionPass } from '../../src/handlers/helpers/openPactSuggestionDigest';

describe('open pacts — rules', () => {
    describe('getHabitMatchKey', () => {
        it('matches a template row on its own key', () => {
            expect(getHabitMatchKey({ name: 'Read', templateKey: 'read' })).to.deep.equal({
                templateKey: 'read', normalizedName: 'read',
            });
        });

        it('matches a clone on the template it came from, whatever language it is named in', () => {
            expect(getHabitMatchKey({ name: 'Leer', sourceTemplateKey: 'read' }).templateKey).to.equal('read');
        });

        it('falls back to a normalized name for a custom habit', () => {
            expect(getHabitMatchKey({ name: '  Learn   Guitar ' })).to.deep.equal({
                templateKey: null, normalizedName: 'learn guitar',
            });
        });

        it('normalizes a missing name to nothing, which matches nothing', () => {
            expect(normalizeHabitName(undefined)).to.equal('');
        });
    });

    describe('isPactJoinable', () => {
        const now = new Date('2026-10-05T12:00:00Z');

        it('is joinable only when open and still running', () => {
            expect(isPactJoinable({ isOpen: true, status: 'pending', endDate: null }, now)).to.equal(true);
            expect(isPactJoinable({ isOpen: true, status: 'active', endDate: '2026-10-20T00:00:00Z' }, now)).to.equal(true);
            expect(isPactJoinable({ isOpen: false, status: 'active', endDate: null }, now)).to.equal(false);
            expect(isPactJoinable({ isOpen: true, status: 'completed', endDate: null }, now)).to.equal(false);
            expect(isPactJoinable({ isOpen: true, status: 'active', endDate: '2026-10-01T00:00:00Z' }, now)).to.equal(false);
        });
    });

    it('dedupes the suggestion once per pact, with nothing time-varying in the key', () => {
        expect(openPactSuggestionDedupeKey('p-1')).to.equal('open-pact-suggestion:p-1');
    });
});

describe('open pacts — the digest suggestion pass', () => {
    const NOW = new Date('2026-10-05T14:00:00Z');
    const context = { brandVariation: BrandVariations.HABITS, whiteLabelOrigin: '' };

    const stalePact = (overrides: any = {}) => ({
        pactId: 'stale-1',
        creatorUserId: 'creator-1',
        habitGoalId: 'goal-1',
        habitGoalName: 'Leer',
        templateKey: null,
        sourceTemplateKey: 'read',
        userName: 'creator',
        firstName: 'Cam',
        email: 'cam@example.com',
        isUnclaimed: false,
        settingsEmailReminders: true,
        settingsLocale: 'es',
        ...overrides,
    });

    const openMatch = (overrides: any = {}) => ({ id: 'open-1', hasPendingJoinRequest: false, ...overrides });

    let queuePush: sinon.SinonStub;
    let claim: sinon.SinonStub;
    let getOpenPactsStub: sinon.SinonStub;
    let sendEmail: sinon.SinonStub;

    const stub = ({
        stale = [stalePact()],
        matches = [openMatch()],
        deviceUserIds = ['creator-1'],
        preferences = {},
        claimed = true,
    }: any = {}) => {
        sinon.stub(Store.pacts, 'getStalePendingForOpenSuggestion').resolves(stale);
        getOpenPactsStub = sinon.stub(Store.pacts, 'getOpenPacts').resolves(matches);
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers')
            .resolves(deviceUserIds.map((userId: string) => ({ userId, token: 't' })) as any);
        sinon.stub(Store.users, 'getHabitReminderPreferences').resolves(preferences);
        claim = sinon.stub(Store.pacts, 'claimOpenSuggestion').resolves(claimed);
        sendEmail = sinon.stub(sendEmailModule, 'default').resolves({} as any);
        queuePush = sinon.stub().resolves('queued');
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_OPEN_PACT_SUGGESTIONS_ENABLED;
    });

    it('reads the window of unanswered pacts, 3 to 21 days old', async () => {
        stub({ stale: [] });
        await runOpenPactSuggestionPass(queuePush, context, NOW);

        const [before, after] = (Store.pacts.getStalePendingForOpenSuggestion as sinon.SinonStub).firstCall.args;
        expect(before.toISOString()).to.equal('2026-10-02T14:00:00.000Z');
        expect(after.toISOString()).to.equal('2026-09-14T14:00:00.000Z');
    });

    it('queues one push, once per pact, when an open pact on the same habit has room', async () => {
        stub();
        const counters = await runOpenPactSuggestionPass(queuePush, context, NOW);

        expect(counters.suggestionsQueued).to.equal(1);
        expect(getOpenPactsStub.firstCall.args[0]).to.equal('creator-1');
        expect(getOpenPactsStub.firstCall.args[1]).to.deep.equal({ templateKey: 'read', normalizedName: 'leer' });
        expect(claim.calledOnceWith('stale-1')).to.equal(true);
        const [toUserId, type, dedupeKey, extras] = queuePush.firstCall.args;
        expect(toUserId).to.equal('creator-1');
        expect(type).to.equal(PushNotifications.Types.openPactSuggestion);
        expect(dedupeKey).to.equal('open-pact-suggestion:stale-1');
        expect(extras).to.include({ pactId: 'stale-1', habitGoalId: 'goal-1', habitName: 'Leer' });
        expect(sendEmail.called).to.equal(false);
    });

    it('sends nothing, and claims nothing, when no open pact matches', async () => {
        stub({ matches: [openMatch({ hasPendingJoinRequest: true })] });
        const counters = await runOpenPactSuggestionPass(queuePush, context, NOW);

        expect(counters.suggestionsNoOpenMatch).to.equal(1);
        expect(claim.called).to.equal(false);
        expect(queuePush.called).to.equal(false);
    });

    it('emails a creator with no Habits device registered', async () => {
        stub({ deviceUserIds: [] });
        const counters = await runOpenPactSuggestionPass(queuePush, context, NOW);

        expect(counters.suggestionsEmailed).to.equal(1);
        expect(queuePush.called).to.equal(false);
        expect(sendEmail.firstCall.args[0]).to.include({ locale: 'es' });
        expect(sendEmail.firstCall.args[0].toAddresses).to.deep.equal(['cam@example.com']);
    });

    it('falls back to email when habit pushes are muted, and skips a creator who muted both', async () => {
        stub({ preferences: { 'creator-1': { settingsPushHabitReminders: false } } });
        expect((await runOpenPactSuggestionPass(queuePush, context, NOW)).suggestionsEmailed).to.equal(1);

        sinon.restore();
        stub({
            preferences: { 'creator-1': { settingsPushHabitReminders: false } },
            stale: [stalePact({ settingsEmailReminders: false })],
        });
        const counters = await runOpenPactSuggestionPass(queuePush, context, NOW);
        expect(counters.suggestionsNoChannel).to.equal(1);
        expect(claim.called).to.equal(false);
    });

    it('sends nothing when an overlapping run already claimed the pact', async () => {
        stub({ claimed: false });
        const counters = await runOpenPactSuggestionPass(queuePush, context, NOW);

        expect(counters.suggestionsDeduped).to.equal(1);
        expect(queuePush.called).to.equal(false);
    });

    it('prompts each creator at most once per run', async () => {
        stub({ stale: [stalePact(), stalePact({ pactId: 'stale-2' })] });
        const counters = await runOpenPactSuggestionPass(queuePush, context, NOW);

        expect(counters.suggestionsQueued).to.equal(1);
        expect(counters.suggestionsDeferredSameUser).to.equal(1);
        expect(claim.calledOnceWith('stale-1')).to.equal(true);
    });

    it('does nothing at all when switched off', async () => {
        process.env.HABIT_OPEN_PACT_SUGGESTIONS_ENABLED = 'false';
        stub();
        const counters = await runOpenPactSuggestionPass(queuePush, context, NOW);

        expect(counters.stalePactsEvaluated).to.equal(0);
        expect((Store.pacts.getStalePendingForOpenSuggestion as sinon.SinonStub).called).to.equal(false);
    });
});
