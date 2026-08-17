import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, expect } from '@jest/globals';

const mockSubmitSpaceCorrection = jest.fn();

jest.mock('therr-react/services', () => ({
    MapsService: {
        submitSpaceCorrection: (...args: any[]) => mockSubmitSpaceCorrection(...args),
    },
}));

jest.mock('react-redux', () => ({
    useSelector: (selector: any) => selector({ user: { settings: { mobileThemeName: 'light' } } }),
}));

jest.mock('../../main/utilities/anonSessionId', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve('anon-session-uuid')),
}));

import { Provider as PaperProvider } from 'react-native-paper';
import SuggestEditModal from '../../main/components/Modals/SuggestEditModal';
import ModalButton from '../../main/components/Modals/ModalButton';
import { buildStyles as buildFormStyles } from '../../main/styles/forms';
import { buildStyles as buildButtonsStyles } from '../../main/styles/buttons';
import translator from '../../main/utilities/translator';
import enUs from '../../main/locales/en-us/dictionary.json';

// The real translator is used rather than a stub: the "did this key resolve?"
// fallback in the modal only behaves correctly against a dictionary that echoes
// missing keys back, which is exactly what the shared translator does.
const translate = (key: string, params?: any) => translator('en-us', key, params);
const copy = (enUs as any).pages.viewSpace.suggestEdit;

// react-test-renderer's JSON tree nests text arbitrarily deep, so collect every
// rendered string rather than asserting against a serialized blob.
const collectText = (node: any, found: string[] = []): string[] => {
    if (typeof node === 'string') {
        found.push(node);
    } else if (Array.isArray(node)) {
        node.forEach((child) => collectText(child, found));
    } else if (node && typeof node === 'object') {
        collectText(node.children, found);
    }
    return found;
};

const renderedText = (component: renderer.ReactTestRenderer) => collectText(component.toJSON());

const renderModal = async (props: any = {}) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <PaperProvider>
                <SuggestEditModal
                    isVisible={true}
                    onRequestClose={jest.fn()}
                    spaceId="space-1"
                    translate={translate}
                    themeButtons={buildButtonsStyles('light')}
                    themeForms={buildFormStyles('light')}
                    {...props}
                />
            </PaperProvider>,
        );
    });

    return component!;
};

const getModalButton = (component: renderer.ReactTestRenderer, title: string) => component.root
    .findAllByType(ModalButton)
    .find((button) => button.props.title === title);

const setValue = async (component: renderer.ReactTestRenderer, value: string) => {
    const input = component.root.findAllByProps({ testID: 'suggest-edit-value-input' })[0];
    await act(async () => {
        input.props.onChangeText(value);
    });
};

const submit = async (component: renderer.ReactTestRenderer) => {
    await act(async () => {
        getModalButton(component, copy.submit)?.props.onPress();
    });
};

describe('SuggestEditModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSubmitSpaceCorrection.mockResolvedValue({
            data: {
                status: 'pending', agreementCount: 1, threshold: 3, isOwnerClaimed: false,
            },
        });
    });

    it('disables submit until the value normalizes', async () => {
        const component = await renderModal();

        expect(getModalButton(component, copy.submit)?.props.disabled).toBe(true);

        await setValue(component, '555');
        expect(getModalButton(component, copy.submit)?.props.disabled).toBe(true);

        await setValue(component, '(415) 555-1234');
        expect(getModalButton(component, copy.submit)?.props.disabled).toBe(false);
    });

    it('previews the canonical value and explains an invalid one', async () => {
        const component = await renderModal();

        await setValue(component, '415.555.1234');
        expect(renderedText(component)).toContain(`${copy.normalizedPreview}: +14155551234`);

        await setValue(component, '555');
        expect(renderedText(component)).toContain(copy.errors.INVALID_PHONE);
    });

    it('submits the canonical value with the anonymous session header', async () => {
        const component = await renderModal();

        await setValue(component, '(415) 555-1234');
        await submit(component);

        expect(mockSubmitSpaceCorrection).toHaveBeenCalledWith(
            'space-1',
            { fieldName: 'phoneNumber', value: '+14155551234' },
            { 'x-anon-session-id': 'anon-session-uuid' },
        );
    });

    it('reports how many more agreements a pending correction needs', async () => {
        const component = await renderModal();

        await setValue(component, '(415) 555-1234');
        await submit(component);

        expect(renderedText(component)).toContain(
            translate('pages.viewSpace.suggestEdit.pendingMessage', { remaining: 2 }),
        );
    });

    it('tells the submitter when the space has an owner', async () => {
        mockSubmitSpaceCorrection.mockResolvedValue({
            data: {
                status: 'pending', agreementCount: 1, threshold: 3, isOwnerClaimed: true,
            },
        });
        const component = await renderModal();

        await setValue(component, '(415) 555-1234');
        await submit(component);

        expect(renderedText(component)).toContain(copy.ownerClaimedMessage);
    });

    it('notifies the caller when a correction is applied immediately', async () => {
        const onApplied = jest.fn();
        mockSubmitSpaceCorrection.mockResolvedValue({
            data: {
                status: 'applied', agreementCount: 3, threshold: 3, isOwnerClaimed: false,
            },
        });
        const component = await renderModal({ onApplied });

        await setValue(component, '(415) 555-1234');
        await submit(component);

        expect(onApplied).toHaveBeenCalledTimes(1);
        expect(renderedText(component)).toContain(copy.appliedMessage);
    });

    it('translates a server rejection code rather than showing it raw', async () => {
        mockSubmitSpaceCorrection.mockRejectedValue({
            response: { status: 400, data: { message: 'INVALID_VALUE:INVALID_PHONE' } },
        });
        const component = await renderModal();

        await setValue(component, '(415) 555-1234');
        await submit(component);

        const text = renderedText(component);
        expect(text).toContain(copy.errors.INVALID_PHONE);
        expect(text.join(' ')).not.toContain('INVALID_VALUE');
    });

    it('falls back to the generic message for an unrecognized server code', async () => {
        mockSubmitSpaceCorrection.mockRejectedValue({
            response: { status: 400, data: { message: 'MISSING_ANON_IDENTITY' } },
        });
        const component = await renderModal();

        await setValue(component, '(415) 555-1234');
        await submit(component);

        const text = renderedText(component);
        expect(text).toContain(copy.errorMessage);
        expect(text.join(' ')).not.toContain('MISSING_ANON_IDENTITY');
    });

    it('shows a rate-limit message when the gateway throttles the submission', async () => {
        mockSubmitSpaceCorrection.mockRejectedValue({
            response: { status: 429, data: { message: 'Submissions are limited. Try again later.' } },
        });
        const component = await renderModal();

        await setValue(component, '(415) 555-1234');
        await submit(component);

        expect(renderedText(component)).toContain(copy.rateLimited);
    });

    it('starts on the website field when asked to', async () => {
        const component = await renderModal({ initialField: 'websiteUrl' });

        await setValue(component, 'www.Example.com/menu/');
        await submit(component);

        expect(mockSubmitSpaceCorrection).toHaveBeenCalledWith(
            'space-1',
            { fieldName: 'websiteUrl', value: 'https://example.com/menu' },
            { 'x-anon-session-id': 'anon-session-uuid' },
        );
    });
});
