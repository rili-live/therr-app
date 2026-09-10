/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import { HABITS_HOSTS, resolveAssetLinksFileName } from '../utilities/wellKnownAssets';

const WELL_KNOWN_SRC_DIR = path.resolve(__dirname, '../_static/.well-known');

describe('wellKnownAssets', () => {
    describe('resolveAssetLinksFileName', () => {
        it('serves the Habits file on both Habits hosts', () => {
            expect(resolveAssetLinksFileName('habits.therr.com')).toBe('assetlinks.habits.json');
            expect(resolveAssetLinksFileName('www.habits.therr.com')).toBe('assetlinks.habits.json');
        });

        // The apex must answer directly: App Links verification does not follow the
        // bare-domain -> www redirect registered later in server-client.
        it('serves the Therr file on therr.com and www.therr.com', () => {
            expect(resolveAssetLinksFileName('therr.com')).toBe('assetlinks.json');
            expect(resolveAssetLinksFileName('www.therr.com')).toBe('assetlinks.json');
        });

        it('falls back to the Therr file for any other host', () => {
            expect(resolveAssetLinksFileName('dashboard.therr.com')).toBe('assetlinks.json');
            expect(resolveAssetLinksFileName('localhost')).toBe('assetlinks.json');
        });
    });

    // Every host in TherrMobile/android/app/build.gradle's appLinkHostsByAppId must
    // resolve to a file that exists and names that build's applicationId. A missing
    // file is a 404 to Google's verifier; a wrong package fails verification silently
    // and Android hands the link back to the browser.
    describe('the resolved files', () => {
        it.each([
            ['therr.com', 'app.therrmobile'],
            ['www.therr.com', 'app.therrmobile'],
            ['habits.therr.com', 'com.therr.habits'],
            ['www.habits.therr.com', 'com.therr.habits'],
        ])('%s delegates to %s', (hostname, packageName) => {
            const filePath = path.join(WELL_KNOWN_SRC_DIR, resolveAssetLinksFileName(hostname));
            expect(fs.existsSync(filePath)).toBe(true);

            const statements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            expect(Array.isArray(statements)).toBe(true);
            expect(statements.length).toBeGreaterThan(0);

            statements.forEach((statement) => {
                expect(statement.relation).toContain('delegate_permission/common.handle_all_urls');
                expect(statement.target.namespace).toBe('android_app');
                expect(statement.target.package_name).toBe(packageName);
                expect(statement.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
            });
        });
    });

    it('keeps HABITS_HOSTS as the single source of truth for both hosts', () => {
        expect([...HABITS_HOSTS].sort()).toEqual(['habits.therr.com', 'www.habits.therr.com']);
    });
});
