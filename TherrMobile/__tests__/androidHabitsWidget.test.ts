import fs from 'fs';
import path from 'path';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import { WIDGET_ACTION_SUFFIXES, WIDGET_REFRESH_TASK_KEY } from '../main/utilities/habitsWidget';

/**
 * Guards the coupling between the home-screen widget's native half and its JS half.
 *
 * HabitsWidgetProvider.kt builds its tap intents from string constants, and Layout routes
 * them by suffix through `getWidgetActionRoute`. Neither side can see the other, so a rename
 * on one side still builds, still draws, and turns the tap into a plain app launch — the
 * same silent dead-tap failure androidNotificationIntentFilters.test.ts exists for.
 *
 * The background refresh has the same shape: the worker starts a headless task by a string
 * key that index.js registers by the same string, and JS calls native methods by name. A
 * drift on either side means a widget that never refreshes, with nothing to report it.
 *
 * Reads the real Kotlin, manifest, resources and entry point rather than copies.
 */

const MOBILE_DIR = path.resolve(__dirname, '..');
const ANDROID_MAIN_DIR = path.join(MOBILE_DIR, 'android/app/src/main');
const PROVIDER_PATH = path.join(ANDROID_MAIN_DIR, 'java/app/therrmobile/widget/HabitsWidgetProvider.kt');
const WORKER_PATH = path.join(ANDROID_MAIN_DIR, 'java/app/therrmobile/widget/HabitsWidgetRefreshWorker.kt');
const MODULE_PATH = path.join(ANDROID_MAIN_DIR, 'java/app/therrmobile/modules/HabitsWidgetModule.kt');
const MAIN_APPLICATION_PATH = path.join(ANDROID_MAIN_DIR, 'java/app/therrmobile/MainApplication.kt');
const MANIFEST_PATH = path.join(ANDROID_MAIN_DIR, 'AndroidManifest.xml');
const WIDGET_INFO_PATH = path.join(ANDROID_MAIN_DIR, 'res/xml/habits_widget_info.xml');
const LAYOUT_PATH = path.join(ANDROID_MAIN_DIR, 'res/layout/widget_habits.xml');
const APP_GRADLE_PATH = path.join(MOBILE_DIR, 'android/app/build.gradle');
const ENTRY_PATH = path.join(MOBILE_DIR, 'index.js');

const provider = fs.readFileSync(PROVIDER_PATH, 'utf8');
const worker = fs.readFileSync(WORKER_PATH, 'utf8');
const nativeModule = fs.readFileSync(MODULE_PATH, 'utf8');
const entry = fs.readFileSync(ENTRY_PATH, 'utf8');

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

    it('exposes the native module under the name JS looks up, with every method JS calls', () => {
        const mainApplication = fs.readFileSync(MAIN_APPLICATION_PATH, 'utf8');

        expect(nativeModule).toContain('const val NAME = "HabitsWidget"');
        expect(mainApplication).toContain('HabitsWidgetPackage()');
        ['setSnapshot', 'clear', 'finishRefresh', 'hasWidgets'].forEach((method) => {
            expect(nativeModule).toMatch(new RegExp(`@ReactMethod\\s+fun ${method}\\(`));
        });
    });
});

describe('Android habits widget board toggle', () => {
    it('draws both halves of the toggle from the labels JS publishes, in every locale', () => {
        const layout = fs.readFileSync(LAYOUT_PATH, 'utf8');
        ['widget_scope_toggle', 'widget_scope_friends', 'widget_scope_global'].forEach((id) => {
            expect(layout).toContain(`android:id="@+id/${id}"`);
        });
        expect(provider).toContain('labels.optString("scopeFriends")');
        expect(provider).toContain('labels.optString("scopeEveryone")');

        ['en-us', 'es', 'fr-ca'].forEach((locale) => {
            const dictionary = JSON.parse(fs.readFileSync(path.join(MOBILE_DIR, 'main/locales', locale, 'dictionary.json'), 'utf8'));
            expect(typeof dictionary.pages.leaderboard.tabs.friends).toBe('string');
            expect(typeof dictionary.pages.leaderboard.tabs.everyone).toBe('string');
        });
    });

    it('remembers the pick in prefs, and reads it back when drawing', () => {
        // The pick must outlive every snapshot JS publishes, so it lives beside the snapshot,
        // never inside it.
        expect(provider).toMatch(/override fun onReceive[\s\S]*?putString\(KEY_SCOPE, scope\)/);
        expect(provider).toContain('getString(KEY_SCOPE, null)');
        expect(nativeModule).not.toContain('KEY_SCOPE');
    });

    it('gives each half its own pending intent, so the two taps pick different boards', () => {
        const codes = [...provider.matchAll(/scope = SCOPE_\w+, requestCode = (\d+)/g)].map((match) => Number(match[1]));
        const otherCodes = [...provider.matchAll(/tapIntent\(context, \w+, (\d+)\)/g)].map((match) => Number(match[1]));
        const refreshCode = Number(provider.match(/PendingIntent\.getBroadcast\(\s*context,\s*(\d+),/)?.[1]);

        expect(codes).toHaveLength(2);
        expect(new Set([...codes, ...otherCodes, refreshCode]).size).toBe(codes.length + new Set(otherCodes).size + 1);
    });
});

describe('Android habits widget background refresh', () => {
    it('starts the headless task index.js registers, by the same key', () => {
        expect(worker).toContain(`const val TASK_KEY = "${WIDGET_REFRESH_TASK_KEY}"`);
        expect(entry).toContain('AppRegistry.registerHeadlessTask(WIDGET_REFRESH_TASK_KEY');
    });

    it('runs the task from a WorkManager job, not a service started from the receiver', () => {
        // A service started from a background broadcast throws on Android 8+ unless the app is
        // temporarily allowlisted; enqueuing work never does. See HabitsWidgetRefreshWorker.kt.
        expect(worker).toMatch(/class HabitsWidgetRefreshWorker\(.*\) : Worker\(/);
        expect(worker).toContain('WorkManager.getInstance(context).enqueueUniqueWork(');
        expect(provider).toContain('HabitsWidgetRefreshWorker.enqueue(context, reason)');
        expect(provider).not.toContain('startService(');
        expect(provider).not.toContain('startForegroundService(');
        expect(fs.readFileSync(APP_GRADLE_PATH, 'utf8')).toMatch(/androidx\.work:work-runtime(-ktx)?:/);
    });

    it('asks for a refresh on placement, on the periodic tick and on the label tap', () => {
        expect(provider).toMatch(/override fun onEnabled[\s\S]*?requestRefresh\(context, HabitsWidgetRefreshWorker\.REASON_PLACED\)/);
        expect(provider).toMatch(/override fun onUpdate[\s\S]*?requestRefresh\(context, HabitsWidgetRefreshWorker\.REASON_PERIODIC\)/);
        expect(provider).toMatch(/override fun onReceive[\s\S]*?requestRefresh\(context, HabitsWidgetRefreshWorker\.REASON_TAP\)/);
        expect(fs.readFileSync(LAYOUT_PATH, 'utf8')).toContain('android:id="@+id/widget_updated"');
        expect(provider).toContain('views.setOnClickPendingIntent(R.id.widget_updated, refreshIntent(context))');
    });

    it('ticks at the platform minimum so the refresh actually runs between app sessions', () => {
        const info = fs.readFileSync(WIDGET_INFO_PATH, 'utf8');
        const period = Number(info.match(/android:updatePeriodMillis="(\d+)"/)?.[1]);

        expect(period).toBe(30 * 60 * 1000);
    });

    it('allows the task in the foreground, so a refresh with the app open skips instead of throwing', () => {
        // HeadlessJsTaskContext.startTask throws on the UI thread for a task not allowed in
        // the foreground when the app is resumed — a crash, from a widget tick.
        expect(worker).toMatch(/HeadlessJsTaskConfig\(TASK_KEY, data, TASK_TIMEOUT_MS, true\)/);
    });

    it('lets the module end the refreshing state the provider starts', () => {
        expect(provider).toContain('const val KEY_REFRESHING_SINCE');
        expect(nativeModule).toMatch(/fun setSnapshot[\s\S]*?remove\(HabitsWidgetProvider\.KEY_REFRESHING_SINCE\)/);
        expect(nativeModule).toMatch(/fun clear[\s\S]*?remove\(HabitsWidgetProvider\.KEY_REFRESHING_SINCE\)/);
        expect(nativeModule).toMatch(/fun finishRefresh[\s\S]*?HabitsWidgetProvider\.clearRefreshing\(/);
    });

    it('carries every freshness label the provider reads, in every locale', () => {
        const labelKeys = [...provider.matchAll(/labels\.optString\("(\w+)"/g)].map((match) => match[1]);
        const freshnessKeys = ['refreshing', 'justNow', 'minutesAgo', 'hoursAgo', 'daysAgo', 'refreshHint'];
        freshnessKeys.forEach((key) => expect(labelKeys).toContain(key));

        ['en-us', 'es', 'fr-ca'].forEach((locale) => {
            const dictionary = JSON.parse(fs.readFileSync(path.join(MOBILE_DIR, 'main/locales', locale, 'dictionary.json'), 'utf8'));
            const widget = dictionary.pages.habits.widget;
            freshnessKeys.forEach((key) => expect(typeof widget[key]).toBe('string'));
            expect(widget.minutesAgo).toContain('{minutes}');
            expect(widget.hoursAgo).toContain('{hours}');
            expect(widget.daysAgo).toContain('{days}');
            expect(widget.refreshHint).toContain('{ago}');
        });
    });
});
