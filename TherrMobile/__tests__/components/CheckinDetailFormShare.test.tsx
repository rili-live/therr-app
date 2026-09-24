import 'react-native';
import React from 'react';
import { Text } from 'react-native';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

import {
    it, describe, beforeEach, afterEach, expect, jest,
} from '@jest/globals';

import { Provider as PaperProvider, Switch } from 'react-native-paper';
import ImageCropPicker from 'react-native-image-crop-picker';

/**
 * The share control used to render only after a photo was attached, at the bottom of a
 * sheet whose textarea and full-width preview pushed it below the fold — so nobody found
 * it. It is now always present (disabled until a photo exists), sits directly under the
 * photo, and starts in the position the caller passes from the user's profile visibility.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('react-native-image-crop-picker', () => ({
    __esModule: true,
    default: { openPicker: jest.fn(), openCamera: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-permissions', () => ({
    __esModule: true,
    requestMultiple: jest.fn(() => Promise.resolve({})),
    checkMultiple: jest.fn(() => Promise.resolve({})),
    check: jest.fn(() => Promise.resolve('granted')),
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

jest.mock('../../main/utilities/requestOSPermissions', () => ({
    __esModule: true,
    requestOSCameraPermissions: jest.fn(() => Promise.resolve({ camera: 'granted' })),
}));

import CheckinDetailForm from '../../main/components/Habits/CheckinDetailForm';
import { buildStyles as buildHabitStyles } from '../../main/styles/habits';
import { getTheme } from '../../main/styles/themes';

const translate = (key: string) => key;

const mounted: renderer.ReactTestRenderer[] = [];

/**
 * The form lifts its draft on every change rather than exposing a confirm button — the screen
 * that hosts it (routes/Habits/CheckinDetail) owns the footer and the submit. So the assertions
 * below read the last lifted draft where they used to read an `onConfirm` payload.
 */
const renderForm = async (props: any = {}) => {
    const onChange = jest.fn();
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <PaperProvider>
                <CheckinDetailForm
                    habitName="Run daily"
                    userId="me"
                    canShare
                    onChange={onChange}
                    translate={translate}
                    colors={getTheme('light').colors}
                    styles={buildHabitStyles('light').styles}
                    {...props}
                />
            </PaperProvider>,
        );
    });
    mounted.push(component!);
    const lastDraft = () => onChange.mock.calls[onChange.mock.calls.length - 1][0];
    return { component: component!, onChange, lastDraft };
};

const hasText = (component: renderer.ReactTestRenderer, text: string) => component.root
    .findAllByType(Text)
    .some((node) => node.props.children === text);

// Walks up from the label to the nearest ancestor with an onPress, so the helper does not
// depend on which component type Pressable resolves to under the test renderer.
const pressText = async (component: renderer.ReactTestRenderer, text: string) => {
    const label = component.root.findAllByType(Text).find((t) => t.props.children === text);
    let node: renderer.ReactTestInstance | null = label || null;
    while (node && typeof node.props.onPress !== 'function') {
        node = node.parent;
    }
    if (!node) {
        throw new Error(`No pressable with text ${text}`);
    }
    await act(async () => {
        node!.props.onPress();
    });
};

const getShareSwitch = (component: renderer.ReactTestRenderer) => component.root.findByType(Switch);

const attachPhoto = async (component: renderer.ReactTestRenderer) => {
    (ImageCropPicker.openPicker as jest.Mock).mockResolvedValue({
        path: '/tmp/proof.jpg',
        mime: 'image/jpeg',
        size: 1234,
    } as never);
    await pressText(component, 'pages.habits.checkinProof.choosePhoto');
    // The picker resolves asynchronously; drain it.
    await act(async () => {
        await Promise.resolve();
    });
    expect(hasText(component, 'pages.habits.checkinProof.photoAttached')).toBe(true);
};

describe('CheckinDetailForm — share control', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        mounted.splice(0).forEach((c) => act(() => c.unmount()));
    });

    it('shows the share row before any photo is attached, disabled, and says why', async () => {
        const { component } = await renderForm();

        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyLabel')).toBe(true);
        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyNeedsPhoto')).toBe(true);
        expect(getShareSwitch(component).props.disabled).toBe(true);
    });

    it('does not show the share row at all when sharing is unavailable', async () => {
        const { component } = await renderForm({ canShare: false });

        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyLabel')).toBe(false);
        expect(component.root.findAllByType(Switch)).toHaveLength(0);
    });

    it('defaults the switch on for a public profile once a photo is attached, and reports sharePublicly', async () => {
        const { component, lastDraft } = await renderForm({ defaultSharePublicly: true });
        await attachPhoto(component);

        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyHint')).toBe(true);
        expect(getShareSwitch(component).props.disabled).toBe(false);
        expect(getShareSwitch(component).props.value).toBe(true);

        expect(lastDraft()).toEqual(expect.objectContaining({ sharePublicly: true }));
    });

    it('defaults the switch off for a private profile', async () => {
        const { component, lastDraft } = await renderForm({ defaultSharePublicly: false });
        await attachPhoto(component);

        expect(getShareSwitch(component).props.value).toBe(false);
        expect(lastDraft()).toEqual(expect.objectContaining({ sharePublicly: false }));
    });

    it('never reports a share without a photo, even when the default is on', async () => {
        const { lastDraft } = await renderForm({ defaultSharePublicly: true });

        expect(lastDraft()).toEqual(expect.objectContaining({ sharePublicly: false, image: null }));
    });
});

describe('CheckinDetailForm — proof XP hint', () => {
    afterEach(() => {
        mounted.splice(0).forEach((c) => act(() => c.unmount()));
    });

    it('tells the user a note and a photo earn bonus XP, with a photo worth more', async () => {
        const hintParams: any[] = [];
        const translateWithParams = (key: string, params?: any) => {
            if (key === 'pages.habits.checkinProof.xpHint') {
                hintParams.push(params);
            }
            return key;
        };
        const { component } = await renderForm({ translate: translateWithParams });

        expect(hasText(component, 'pages.habits.checkinProof.xpHint')).toBe(true);
        const params = hintParams[hintParams.length - 1];
        expect(params.photoPoints).toBeGreaterThan(params.notePoints);
        expect(params.bothPoints).toBe(params.notePoints + params.photoPoints);
    });
});
