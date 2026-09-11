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

import CheckinProofSheet from '../../main/components/Habits/CheckinProofSheet';
import ModalButton from '../../main/components/Modals/ModalButton';
import { buildStyles as buildConfirmModalStyles } from '../../main/styles/modal/confirmModal';
import { buildStyles as buildButtonStyles } from '../../main/styles/buttons';

const translate = (key: string) => key;

const mounted: renderer.ReactTestRenderer[] = [];

const renderSheet = async (props: any = {}) => {
    const onConfirm = jest.fn();
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <PaperProvider>
                <CheckinProofSheet
                    isVisible
                    habitName="Run daily"
                    userId="me"
                    canShare
                    onCancel={jest.fn()}
                    onConfirm={onConfirm}
                    translate={translate}
                    themeConfirmModal={buildConfirmModalStyles('light')}
                    themeButtons={buildButtonStyles('light')}
                    {...props}
                />
            </PaperProvider>,
        );
    });
    mounted.push(component!);
    return { component: component!, onConfirm };
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

const pressSave = async (component: renderer.ReactTestRenderer) => {
    const button = component.root
        .findAllByType(ModalButton)
        .find((b) => b.props.title === 'pages.habits.checkinProof.save');
    await act(async () => {
        button!.props.onPress();
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

describe('CheckinProofSheet — share control', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        mounted.splice(0).forEach((c) => act(() => c.unmount()));
    });

    it('shows the share row before any photo is attached, disabled, and says why', async () => {
        const { component } = await renderSheet();

        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyLabel')).toBe(true);
        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyNeedsPhoto')).toBe(true);
        expect(getShareSwitch(component).props.disabled).toBe(true);
    });

    it('does not show the share row at all when sharing is unavailable', async () => {
        const { component } = await renderSheet({ canShare: false });

        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyLabel')).toBe(false);
        expect(component.root.findAllByType(Switch)).toHaveLength(0);
    });

    it('defaults the switch on for a public profile once a photo is attached, and confirms with sharePublicly', async () => {
        const { component, onConfirm } = await renderSheet({ defaultSharePublicly: true });
        await attachPhoto(component);

        expect(hasText(component, 'pages.habits.checkinProof.sharePubliclyHint')).toBe(true);
        expect(getShareSwitch(component).props.disabled).toBe(false);
        expect(getShareSwitch(component).props.value).toBe(true);

        await pressSave(component);

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ sharePublicly: true }));
    });

    it('defaults the switch off for a private profile', async () => {
        const { component, onConfirm } = await renderSheet({ defaultSharePublicly: false });
        await attachPhoto(component);

        expect(getShareSwitch(component).props.value).toBe(false);

        await pressSave(component);

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ sharePublicly: false }));
    });

    it('never confirms a share without a photo, even when the default is on', async () => {
        const { component, onConfirm } = await renderSheet({ defaultSharePublicly: true });

        await pressSave(component);

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ sharePublicly: false, image: undefined }));
    });
});
