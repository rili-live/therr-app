import 'react-native';
import React from 'react';
import { TextInput } from 'react-native';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

import {
    it, describe, beforeEach, afterEach, expect, jest,
} from '@jest/globals';

import { Provider as PaperProvider } from 'react-native-paper';

/**
 * The check-in POST upserts today's row, and the server reads `savedAmount: null` as
 * "clear the recorded amount". The amount field is never prefilled, so a draft that
 * carried null for an empty or unparseable field made an ordinary "add a note" save on a
 * savings habit erase the amount logged earlier that day from the notification
 * quick-reply. The draft must carry a number or nothing.
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

const AMOUNT_LABEL = 'pages.habits.savings.checkinAmountLabel';

const mounted: renderer.ReactTestRenderer[] = [];

const renderForm = async (props: any = {}) => {
    const onChange = jest.fn();
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <PaperProvider>
                <CheckinDetailForm
                    habitName="Save for the trip"
                    userId="me"
                    isSavingsGoal
                    currencyCode="USD"
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
    const lastDraft = () => onChange.mock.calls[onChange.mock.calls.length - 1][0] as any;
    return { component: component!, lastDraft };
};

const typeAmount = async (component: renderer.ReactTestRenderer, text: string) => {
    const input = component.root
        .findAllByType(TextInput)
        .find((node) => node.props.accessibilityLabel === AMOUNT_LABEL);
    if (!input) {
        throw new Error('No savings amount field rendered');
    }
    await act(async () => {
        input.props.onChangeText(text);
    });
};

describe('CheckinDetailForm — savings amount', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        mounted.splice(0).forEach((c) => act(() => c.unmount()));
    });

    it('does not clear an amount already logged today when the field is left empty', async () => {
        const { lastDraft } = await renderForm();

        expect(lastDraft().savedAmount).toBeUndefined();
        expect(lastDraft().hasInvalidSavedAmount).toBe(false);
    });

    it('carries the parsed amount once a valid one is typed', async () => {
        const { component, lastDraft } = await renderForm();
        await typeAmount(component, '25.50');

        expect(lastDraft().savedAmount).toBe(25.5);
        expect(lastDraft().hasInvalidSavedAmount).toBe(false);
    });

    it('does not turn an emptied field into a clearing null', async () => {
        const { component, lastDraft } = await renderForm();
        await typeAmount(component, '25');
        await typeAmount(component, '');

        expect(lastDraft().savedAmount).toBeUndefined();
    });

    it('flags unparseable text instead of silently sending nothing — or null', async () => {
        const { component, lastDraft } = await renderForm();
        await typeAmount(component, 'abc');

        expect(lastDraft().savedAmount).toBeUndefined();
        expect(lastDraft().hasInvalidSavedAmount).toBe(true);
    });

    it('sends no amount at all on a habit that does not track money', async () => {
        const { component, lastDraft } = await renderForm({ isSavingsGoal: false });

        expect(component.root.findAllByType(TextInput)
            .some((node) => node.props.accessibilityLabel === AMOUNT_LABEL)).toBe(false);
        expect(lastDraft().savedAmount).toBeUndefined();
        expect(lastDraft().hasInvalidSavedAmount).toBe(false);
    });
});
