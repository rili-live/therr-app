import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import { ITherrThemeColors } from '../../styles/themes';
import ModalButton from './ModalButton';

/**
 * Two-step review prompt: sentiment first, store link second.
 *
 * The user is asked whether they are enjoying the app before a review is ever mentioned.
 * "Yes" leads to the store listing; "not really" leads to support, so an unhappy user is
 * routed to a person rather than to a public one-star review. Only the happy branch can
 * reach the store — that gating is the whole point of the pattern, and it is also why this
 * links out to the store instead of calling Apple's or Google's native in-app review APIs,
 * whose policies forbid preceding them with a satisfaction question.
 */

export type AppReviewPromptOutcome =
    /** Closed without answering, or asked again later — eligible for a future prompt. */
    | 'dismissed'
    /** Sent to the store listing. */
    | 'reviewRequested'
    /** Asked to contact support instead. */
    | 'feedbackRequested'
    /** Not enjoying the app and not interested in contacting support. */
    | 'declined';

type PromptStage = 'sentiment' | 'review' | 'feedback';

interface IAppReviewPromptModalProps {
    isVisible: boolean;
    onClose: (outcome: AppReviewPromptOutcome) => void;
    translate: Function;
    themeModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const AppReviewPromptModal: React.FC<IAppReviewPromptModalProps> = ({
    isVisible,
    onClose,
    translate,
    themeModal,
    themeButtons,
}) => {
    const [stage, setStage] = useState<PromptStage>('sentiment');

    // Layout keeps this mounted across the whole session, so a prompt shown months later
    // would otherwise reopen on whichever stage the last one ended.
    useEffect(() => {
        if (isVisible) {
            setStage('sentiment');
        }
    }, [isVisible]);

    const headerTextByStage: { [key in PromptStage]: string } = {
        sentiment: translate('modals.appReviewPrompt.sentiment.header'),
        review: translate('modals.appReviewPrompt.review.header'),
        feedback: translate('modals.appReviewPrompt.feedback.header'),
    };
    const messageByStage: { [key in PromptStage]: string } = {
        sentiment: translate('modals.appReviewPrompt.sentiment.message'),
        review: translate('modals.appReviewPrompt.review.message'),
        feedback: translate('modals.appReviewPrompt.feedback.message'),
    };

    // Plain lists rather than Fragments: `Dialog.Actions` clones each direct child with
    // `compact` and `style`, and a Fragment child accepts neither — React warns "Invalid prop
    // `compact` supplied to `React.Fragment`" and the buttons lose Paper's action spacing.
    const actionsByStage: { [key in PromptStage]: { iconName: string; titleKey: string; onPress: () => void }[] } = {
        sentiment: [
            { iconName: 'thumb-down-outline', titleKey: 'modals.appReviewPrompt.sentiment.notReally', onPress: () => setStage('feedback') },
            { iconName: 'thumb-up-outline', titleKey: 'modals.appReviewPrompt.sentiment.yes', onPress: () => setStage('review') },
        ],
        review: [
            { iconName: 'clock-outline', titleKey: 'modals.appReviewPrompt.review.maybeLater', onPress: () => onClose('dismissed') },
            { iconName: 'star', titleKey: 'modals.appReviewPrompt.review.writeReview', onPress: () => onClose('reviewRequested') },
        ],
        feedback: [
            { iconName: 'close', titleKey: 'modals.appReviewPrompt.feedback.noThanks', onPress: () => onClose('declined') },
            { iconName: 'email-outline', titleKey: 'modals.appReviewPrompt.feedback.sendFeedback', onPress: () => onClose('feedbackRequested') },
        ],
    };

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                // A tap outside is an answer of "not now", never a decline: the user has not
                // told us anything about how they feel, so they stay eligible later.
                onDismiss={() => onClose('dismissed')}
                style={themeModal.styles.container}
            >
                <Dialog.Title style={themeModal.styles.headerText}>{headerTextByStage[stage]}</Dialog.Title>
                <Dialog.Content>
                    <Text style={themeModal.styles.bodyText}>{messageByStage[stage]}</Text>
                </Dialog.Content>
                <Dialog.Actions style={themeModal.styles.buttonsContainer}>
                    {actionsByStage[stage].map((action) => (
                        <ModalButton
                            key={action.titleKey}
                            iconName={action.iconName}
                            title={translate(action.titleKey)}
                            onPress={action.onPress}
                            iconRight={false}
                            themeButtons={themeButtons}
                        />
                    ))}
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default AppReviewPromptModal;
