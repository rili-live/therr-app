import { expect } from 'chai';
import sinon from 'sinon';
import UserAcquisitionStore, { sanitizeUserAcquisition } from '../../src/store/UserAcquisitionStore';

const buildMockConnection = () => {
    const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    const writeStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    return {
        connection: {
            read: { query: readStub } as any,
            write: { query: writeStub } as any,
        },
        readStub,
        writeStub,
    };
};

describe('sanitizeUserAcquisition', () => {
    it('keeps the known utm fields and stamps the userId from context, not the payload', () => {
        const result = sanitizeUserAcquisition({
            userId: 'attacker-supplied',
            utmSource: 'outreach',
            utmMedium: 'email',
            utmCampaign: '3_22_2026_gen_z_local_creators',
            utmContent: 'mentioned-site',
            utmTerm: 'follow-up',
        }, { userId: 'real-user-id', brandVariation: 'therr' });

        expect(result.userId).to.equal('real-user-id');
        expect(result.utmSource).to.equal('outreach');
        expect(result.utmCampaign).to.equal('3_22_2026_gen_z_local_creators');
        expect(result.brandVariation).to.equal('therr');
    });

    it('drops unknown keys so a crafted payload cannot name a column that does not exist', () => {
        const result: any = sanitizeUserAcquisition({
            utmSource: 'blog',
            accessLevels: '["dashboard.subscriber.pro"]',
            password: 'nope',
        }, { userId: 'user-1' });

        expect(result.accessLevels).to.equal(undefined);
        expect(result.password).to.equal(undefined);
        expect(Object.keys(result)).to.have.members([
            'userId', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent',
            'utmTerm', 'referrer', 'landingPath', 'surface', 'brandVariation',
        ]);
    });

    it('truncates each field to its column width', () => {
        const result = sanitizeUserAcquisition({
            utmCampaign: 'c'.repeat(500),
            referrer: `https://example.com/${'r'.repeat(2000)}`,
            landingPath: `/${'p'.repeat(1000)}`,
        }, { userId: 'user-1' });

        expect(result.utmCampaign).to.have.lengthOf(255);
        expect(result.referrer).to.have.lengthOf(1024);
        expect((result.landingPath as string).length).to.be.at.most(512);
    });

    it('strips the query string and fragment from landingPath', () => {
        // The query string is where password-reset and email-verification
        // tokens live; an analytics table must not durably store them.
        const result = sanitizeUserAcquisition({
            landingPath: '/reset-password?token=secret-value#section',
        }, { userId: 'user-1' });

        expect(result.landingPath).to.equal('/reset-password');
    });

    it('treats a non-object payload as empty rather than throwing', () => {
        [null, undefined, 'utm_source=x', 42, []].forEach((payload) => {
            const result = sanitizeUserAcquisition(payload, { userId: 'user-1' });
            expect(result.userId).to.equal('user-1');
            expect(result.utmSource).to.equal(undefined);
        });
    });

    it('normalizes blank and whitespace-only values to undefined', () => {
        const result = sanitizeUserAcquisition({
            utmSource: '   ',
            utmMedium: '',
            utmCampaign: '  spaced  ',
        }, { userId: 'user-1' });

        expect(result.utmSource).to.equal(undefined);
        expect(result.utmMedium).to.equal(undefined);
        expect(result.utmCampaign).to.equal('spaced');
    });
});

describe('UserAcquisitionStore', () => {
    it('inserts against main.userAcquisition on the write connection', () => {
        const { connection, writeStub } = buildMockConnection();
        const store = new UserAcquisitionStore(connection);

        store.createAcquisition({ userId: 'user-1', utmCampaign: 'spring-outreach' });

        const queryString = writeStub.args[0][0];
        expect(queryString).to.contain('insert into "main"."userAcquisition"');
        expect(queryString).to.contain('spring-outreach');
    });

    it('restricts the campaign rollup to tagged rows so it matches the partial index', () => {
        const { connection, readStub } = buildMockConnection();
        const store = new UserAcquisitionStore(connection);

        store.countByCampaign('2026-08-01', '2026-09-01');

        const queryString = readStub.args[0][0];
        expect(queryString).to.contain('"utmCampaign" is not null');
        expect(queryString).to.contain('group by');
        expect(queryString).to.contain('"createdAt" >=');
    });
});
