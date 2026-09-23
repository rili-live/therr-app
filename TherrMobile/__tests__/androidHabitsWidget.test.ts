import fs from 'fs';
import path from 'path';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import { WIDGET_ACTION_SUFFIXES } from '../main/utilities/habitsWidget';

/**
 * Guards the coupling between the home-screen widget's native half and its JS half.
 *
 * HabitsWidgetProvider.kt builds its tap intents from string constants, and Layout routes
 * them by suffix through `getWidgetActionRoute`. Neither side can see the other, so a rename
 * on one side still builds, still draws, and turns the tap into a plain app launch — the
 * same silent dead-tap failure androidNotificationIntentFilters.test.ts exists for.
 *
 * Reads the real Kotlin, manifest and module name rather than copies.
 */

const ANDROID_MAIN_DIR = path.resolve(__dirname, '../android/app/src/main');
const PROVIDER_PATH = path.join(ANDROID_MAIN_DIR, 'java/app/therrmobile/widget/HabitsWidgetProvider.kt');
const MODULE_PATH = path.join(ANDROID_MAIN_DIR, 'java/app/therrmobile/modules/HabitsWidgetModule.kt');
const MAIN_APPLICATION_PATH = path.join(ANDROID_MAIN_DIR, 'java/app/therrmobile/MainApplication.kt');
const MANIFEST_PATH = path.join(ANDROID_MAIN_DIR, 'AndroidManifest.xml');

const provider = fs.readFileSync(PROVIDER_PATH, 'utf8');

describe('Android habits widget wiring', () => {
    it('fires every action JS routes', () => {
        Object.values(WIDGET_ACTION_SUFFIXES).forEach((suffix) => {
            // Suffixes carry their leading dot; the provider prepends `${packageName}.`.
            expect(provider).toContain(`"${suffix.slice(1)}"`);
        });
    });

    it('is registered as an app-widget receiver', () => {
        const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');

        expect(manifest).toMatch(/<receiver[^>]*android:name="\.widget\.HabitsWidgetProvider"/);
        expect(manifest).toContain('android:resource="@xml/habits_widget_info"');
    });

    it('exposes the native module under the name JS looks up', () => {
        const nativeModule = fs.readFileSync(MODULE_PATH, 'utf8');
        const mainApplication = fs.readFileSync(MAIN_APPLICATION_PATH, 'utf8');

        expect(nativeModule).toContain('const val NAME = "HabitsWidget"');
        expect(mainApplication).toContain('HabitsWidgetPackage()');
    });
});
