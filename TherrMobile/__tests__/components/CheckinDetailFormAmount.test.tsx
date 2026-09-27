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
 * A measured habit (not a savings goal, with an opted-in unit) gets the same optional
 * amount field as a savings one, labelled in its unit. A habit without a unit gets no
 * field at all: amount tracking is opt-in.
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

const AMOUNT_LABEL = 'pages.habits.amounts.checkinAmountLabel';

const mounted: renderer.ReactTestRenderer[] = [];

const renderForm = async (props: any = {}) => {
    const onChange = jest.fn();
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <PaperProvider>
                <CheckinDetailForm
                    habitName="Read"
                    userId="me"
                    amountUnit="pages"
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
    const amountInput = () => component!.root
        .findAllByType(TextInput)
        .find((node) => node.props.accessibilityLabel === AMOUNT_LABEL);
    return { component: component!, lastDraft, amountInput };
};

describe('CheckinDetailForm — measured habit amount', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        mounted.splice(0).forEach((c) => act(() => c.unmount()));
    });

    it('offers an optional amount field in the habit\'s unit', async () => {
        const { amountInput, lastDraft } = await renderForm();

        expect(amountInput()).toBeDefined();
        // Empty is a complete check-in, not an error.
        expect(lastDraft().savedAmount).toBeUndefined();
        expect(lastDraft().hasInvalidSavedAmount).toBe(false);
    });

    it('carries the parsed amount once one is typed', async () => {
        const { amountInput, lastDraft } = await renderForm();
        await act(async () => {
            amountInput()!.props.onChangeText('30');
        });

        expect(lastDraft().savedAmount).toBe(30);
    });

    it('shows no field on a habit that does not track an amount', async () => {
        const { amountInput, lastDraft } = await renderForm({ amountUnit: null });

        expect(amountInput()).toBeUndefined();
        expect(lastDraft().savedAmount).toBeUndefined();
    });

    it('ignores a stray unit on a savings goal, which uses its own money field', async () => {
        const { amountInput } = await renderForm({ isSavingsGoal: true, currencyCode: 'USD' });

        expect(amountInput()).toBeUndefined();
    });
});
