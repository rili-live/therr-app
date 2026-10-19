import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { getAppVersionPolicy } from '../../src/handlers/appVersion';
import {
    compareAppVersions,
    getAppVersionConfigKeys,
    normalizeAppOs,
    resolveAppVersionPolicy,
} from '../../src/utilities/appVersionPolicy';

const mockRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

describe('appVersionPolicy', () => {
    describe('compareAppVersions', () => {
        it('compares segments numerically, not lexically', () => {
            expect(compareAppVersions('1.10.0', '1.9.3')).to.be.greaterThan(0);
            expect(compareAppVersions('1.9.3', '1.10.0')).to.be.lessThan(0);
        });

        it('treats missing trailing segments as zero', () => {
            expect(compareAppVersions('1.2', '1.2.0')).to.equal(0);
            expect(compareAppVersions('2', '1.99.99')).to.be.greaterThan(0);
        });
    });

    describe('normalizeAppOs', () => {
        it('accepts android and ios case-insensitively', () => {
            expect(normalizeAppOs('Android')).to.equal('android');
            expect(normalizeAppOs('ios')).to.equal('ios');
        });

        it('rejects anything else, so a header cannot mint an arbitrary config key', () => {
            expect(normalizeAppOs('web')).to.equal(null);
            expect(normalizeAppOs('android.minimum')).to.equal(null);
            expect(normalizeAppOs(undefined)).to.equal(null);
        });
    });

    describe('resolveAppVersionPolicy', () => {
        it('requires an update below the minimum, even when a recommendation also applies', () => {
            const policy = resolveAppVersionPolicy({ currentVersion: '1.19.0', minimumVersion: '1.20.0', recommendedVersion: '1.21.0' });
            expect(policy.status).to.equal('required');
        });

        it('recommends an update between the minimum and the recommended version', () => {
            const policy = resolveAppVersionPolicy({ currentVersion: '1.20.0', minimumVersion: '1.20.0', recommendedVersion: '1.21.0' });
            expect(policy.status).to.equal('recommended');
        });

        it('says nothing to a build at or above the recommended version', () => {
            expect(resolveAppVersionPolicy({ currentVersion: '1.21.0', recommendedVersion: '1.21.0' }).status).to.equal('none');
            expect(resolveAppVersionPolicy({ currentVersion: '1.22.0', minimumVersion: '1.20.0' }).status).to.equal('none');
        });

        it('says nothing when no policy rows exist', () => {
            expect(resolveAppVersionPolicy({ currentVersion: '0.0.1' }).status).to.equal('none');
        });

        // A typo in a config row must not lock every install out of the app.
        it('ignores a malformed config value instead of blocking', () => {
            const policy = resolveAppVersionPolicy({ currentVersion: '1.0.0', minimumVersion: 'v2.0', recommendedVersion: '' });
            expect(policy.status).to.equal('none');
            expect(policy.minimumVersion).to.equal(null);
        });

        it('says nothing to a client that did not report a valid version', () => {
            expect(resolveAppVersionPolicy({ currentVersion: undefined, minimumVersion: '9.0.0' }).status).to.equal('none');
            expect(resolveAppVersionPolicy({ currentVersion: 'unknown', minimumVersion: '9.0.0' }).status).to.equal('none');
        });
    });

    describe('getAppVersionPolicy handler', () => {
        afterEach(() => {
            sinon.restore();
        });

        it('reads the rows for the request brand and OS', async () => {
            const getManyStub = sinon.stub(Store.config, 'getMany').resolves([
                { key: 'appVersion.habits.android.minimum', value: '1.20.0' },
                { key: 'appVersion.habits.android.recommended', value: '1.21.0' },
            ]);
            const res = mockRes();

            await getAppVersionPolicy({
                headers: { 'x-brand-variation': 'habits', 'x-app-os': 'android', 'x-app-version': '1.20.1' },
            }, res);

            expect(getManyStub.firstCall.args[0]).to.deep.equal([
                getAppVersionConfigKeys('habits', 'android').minimum,
                getAppVersionConfigKeys('habits', 'android').recommended,
            ]);
            expect(res.status.firstCall.args[0]).to.equal(200);
            expect(res.send.firstCall.args[0]).to.deep.equal({
                status: 'recommended',
                currentVersion: '1.20.1',
                minimumVersion: '1.20.0',
                recommendedVersion: '1.21.0',
            });
        });

        it('does not touch the database for a client without an app version or OS', async () => {
            const getManyStub = sinon.stub(Store.config, 'getMany').resolves([]);
            const res = mockRes();

            await getAppVersionPolicy({ headers: { 'x-brand-variation': 'therr', 'x-platform': 'desktop' } }, res);

            expect(getManyStub.called).to.equal(false);
            expect(res.send.firstCall.args[0].status).to.equal('none');
        });
    });
});
