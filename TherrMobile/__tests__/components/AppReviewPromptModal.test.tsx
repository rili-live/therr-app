import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, expect } from '@jest/globals';

import { Provider as PaperProvider } from 'react-native-paper';
import AppReviewPromptModal from '../../main/components/Modals/AppReviewPromptModal';
import ModalButton from '../../main/components/Modals/ModalButton';
import { buildStyles as buildButtonsStyles } from '../../main/styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../main/styles/modal/confirmModal';
import translator from '../../main/utilities/translator';

/**
 * App Review Prompt Modal Tests
 *
 * The rule this file exists to protect: the store link is reachable ONLY from the "yes, I am
 * enjoying it" branch. Losing that gate turns the prompt into an undirected request for
 * public reviews from users who have just told us they are unhappy.
 */

const translate = (key: string, params?: any) => translator('en-us', key, params);
// Read copy through the translator, not off the raw dictionary: these strings carry an
// `{appName}` placeholder that `utilities/translator` resolves from the active brand, so the
// raw values never match what is rendered.
const copy = {
    sentiment: {
        header: translate('modals.appReviewPrompt.sentiment.header'),
        notReally: translate('modals.appReviewPrompt.sentiment.notReally'),
        yes: translate('modals.appReviewPrompt.sentiment.yes'),
    },
    review: {
        header: translate('modals.appReviewPrompt.review.header'),
        maybeLater: translate('modals.appReviewPrompt.review.maybeLater'),
        writeReview: translate('modals.appReviewPrompt.review.writeReview'),
    },
    feedback: {
        header: translate('modals.appReviewPrompt.feedback.header'),
        noThanks: translate('modals.appReviewPrompt.feedback.noThanks'),
        sendFeedback: translate('modals.appReviewPrompt.feedback.sendFeedback'),
    },
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

const renderedText = (component: renderer.ReactTestRenderer) => collectText(component.toJSON());

const renderModal = async (props: any = {}) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <PaperProvider>
                <AppReviewPromptModal
                    isVisible={true}
                    onClose={jest.fn()}
                    translate={translate}
                    themeModal={buildConfirmModalStyles('light')}
                    themeButtons={buildButtonsStyles('light')}
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

const press = async (component: renderer.ReactTestRenderer, title: string) => {
    await act(async () => {
        getModalButton(component, title)?.props.onPress();
    });
};

describe('AppReviewPromptModal', () => {
    let onClose: jest.Mock;

    beforeEach(() => {
        onClose = jest.fn();
    });

    it('asks about sentiment before it mentions a review', async () => {
        const component = await renderModal({ onClose });
        const text = renderedText(component);

        expect(text).toContain(copy.sentiment.header);
        expect(getModalButton(component, copy.sentiment.notReally)).toBeDefined();
        expect(getModalButton(component, copy.sentiment.yes)).toBeDefined();
        // Nothing about the store is on screen until the user has answered.
        expect(getModalButton(component, copy.review.writeReview)).toBeUndefined();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('offers the store link only after the user says they are enjoying the app', async () => {
        const component = await renderModal({ onClose });

        await press(component, copy.sentiment.yes);

        expect(renderedText(component)).toContain(copy.review.header);
        await press(component, copy.review.writeReview);
        expect(onClose).toHaveBeenCalledWith('reviewRequested');
    });

    it('routes an unhappy user to support and never to the store', async () => {
        const component = await renderModal({ onClose });

        await press(component, copy.sentiment.notReally);

        expect(renderedText(component)).toContain(copy.feedback.header);
        expect(getModalButton(component, copy.review.writeReview)).toBeUndefined();

        await press(component, copy.feedback.sendFeedback);
        expect(onClose).toHaveBeenCalledWith('feedbackRequested');
    });

    it('treats "maybe later" as deferral and an unhappy "no thanks" as opting out', async () => {
        const deferred = await renderModal({ onClose });
        await press(deferred, copy.sentiment.yes);
        await press(deferred, copy.review.maybeLater);
        expect(onClose).toHaveBeenCalledWith('dismissed');

        onClose.mockClear();

        const declined = await renderModal({ onClose });
        await press(declined, copy.sentiment.notReally);
        await press(declined, copy.feedback.noThanks);
        expect(onClose).toHaveBeenCalledWith('declined');
    });

    it('reopens on the sentiment step rather than where the last prompt ended', async () => {
        // Layout keeps this mounted for the life of the session, so a prompt shown months
        // later would otherwise resume mid-flow.
        const component = await renderModal({ onClose });

        await press(component, copy.sentiment.yes);
        expect(renderedText(component)).toContain(copy.review.header);

        await act(async () => {
            component.update(
                <PaperProvider>
                    <AppReviewPromptModal
                        isVisible={false}
                        onClose={onClose}
                        translate={translate}
                        themeModal={buildConfirmModalStyles('light')}
                        themeButtons={buildButtonsStyles('light')}
                    />
                </PaperProvider>,
            );
        });
        await act(async () => {
            component.update(
                <PaperProvider>
                    <AppReviewPromptModal
                        isVisible={true}
                        onClose={onClose}
                        translate={translate}
                        themeModal={buildConfirmModalStyles('light')}
                        themeButtons={buildButtonsStyles('light')}
                    />
                </PaperProvider>,
            );
        });

        expect(renderedText(component)).toContain(copy.sentiment.header);
    });
});
