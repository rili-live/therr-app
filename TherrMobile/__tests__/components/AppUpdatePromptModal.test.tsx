import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

import { Dialog, Provider as PaperProvider } from 'react-native-paper';
import AppUpdatePromptModal from '../../main/components/Modals/AppUpdatePromptModal';
import ModalButton from '../../main/components/Modals/ModalButton';
import { buildStyles as buildButtonsStyles } from '../../main/styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../main/styles/modal/confirmModal';
import translator from '../../main/utilities/translator';

/**
 * App Update Prompt Modal Tests
 *
 * The rule this file protects: a required update has no way past it but the store. A stray
 * "not now", a tap outside or the Android back button would let a build the server has
 * declared broken keep running.
 */

const translate = (key: string, params?: any) => translator('en-us', key, params);
const copy = {
    recommendedHeader: translate('modals.appUpdatePrompt.recommended.header'),
    requiredHeader: translate('modals.appUpdatePrompt.required.header'),
    notNow: translate('modals.appUpdatePrompt.notNow'),
    update: translate('modals.appUpdatePrompt.update'),
};

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

// Paper's Modal animates on mount; unmount every renderer so the animation cannot outlive Jest.
let mounted: renderer.ReactTestRenderer[] = [];

const renderModal = async (props: any) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <PaperProvider>
                <AppUpdatePromptModal
                    onClose={jest.fn()}
                    translate={translate}
                    themeModal={buildConfirmModalStyles('light')}
                    themeButtons={buildButtonsStyles('light')}
                    {...props}
                />
            </PaperProvider>,
        );
    });

    mounted.push(component!);
    return component!;
};

const getModalButton = (component: renderer.ReactTestRenderer, title: string) => component.root
    .findAllByType(ModalButton)
    .find((button) => button.props.title === title);

describe('AppUpdatePromptModal', () => {
    let onClose: jest.Mock;

    beforeEach(() => {
        onClose = jest.fn();
    });

    afterEach(async () => {
        await act(async () => {
            mounted.forEach((component) => component.unmount());
        });
        mounted = [];
    });

    it('lets a recommended update be put off', async () => {
        const component = await renderModal({ promptType: 'recommended', onClose });

        expect(collectText(component.toJSON())).toContain(copy.recommendedHeader);
        expect(component.root.findByType(Dialog).props.dismissable).toBe(true);

        await act(async () => {
            getModalButton(component, copy.notNow)?.props.onPress();
        });
        expect(onClose).toHaveBeenCalledWith('dismissed');
    });

    it('offers only the store for a required update, with no tap-outside or back-button escape', async () => {
        const component = await renderModal({ promptType: 'required', onClose });
        const dialog = component.root.findByType(Dialog);

        expect(collectText(component.toJSON())).toContain(copy.requiredHeader);
        expect(getModalButton(component, copy.notNow)).toBeUndefined();
        expect(dialog.props.dismissable).toBe(false);
        expect(dialog.props.dismissableBackButton).toBe(false);

        await act(async () => {
            getModalButton(component, copy.update)?.props.onPress();
        });
        expect(onClose).toHaveBeenCalledWith('update');
    });

    it('renders nothing when there is no prompt', async () => {
        const component = await renderModal({ promptType: null, onClose });

        expect(component.root.findByType(Dialog).props.visible).toBe(false);
    });
});
