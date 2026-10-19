import React from 'react';
import { Text } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import { ITherrThemeColors } from '../../styles/themes';
import { AppUpdatePromptType } from '../../utilities/appUpdatePrompt';
import ModalButton from './ModalButton';

/**
 * Tells the user their installed build is behind. See `utilities/appUpdatePrompt.ts`.
 *
 * `required` cannot be dismissed — no tap outside, no back button, no "later" — because the
 * server only asks for it when this build can no longer work correctly. `recommended` is a
 * nudge and closes like any other dialog.
 */

export type AppUpdatePromptOutcome = 'update' | 'dismissed';

interface IAppUpdatePromptModalProps {
    promptType: AppUpdatePromptType | null;
    onClose: (outcome: AppUpdatePromptOutcome) => void;
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

const AppUpdatePromptModal: React.FC<IAppUpdatePromptModalProps> = ({
    promptType,
    onClose,
    translate,
    themeModal,
    themeButtons,
}) => {
    const isRequired = promptType === 'required';
    const copyKey = isRequired ? 'required' : 'recommended';

    return (
        <Portal>
            <Dialog
                visible={!!promptType}
                dismissable={!isRequired}
                dismissableBackButton={!isRequired}
                onDismiss={() => onClose('dismissed')}
                style={themeModal.styles.container}
            >
                <Dialog.Title style={themeModal.styles.headerText}>
                    {translate(`modals.appUpdatePrompt.${copyKey}.header`)}
                </Dialog.Title>
                <Dialog.Content>
                    <Text style={themeModal.styles.bodyText}>
                        {translate(`modals.appUpdatePrompt.${copyKey}.message`)}
                    </Text>
                </Dialog.Content>
                <Dialog.Actions style={themeModal.styles.buttonsContainer}>
                    {!isRequired ? (
                        <ModalButton
                            iconName="clock-outline"
                            title={translate('modals.appUpdatePrompt.notNow')}
                            onPress={() => onClose('dismissed')}
                            iconRight={false}
                            themeButtons={themeButtons}
                        />
                    ) : null}
                    <ModalButton
                        iconName="download"
                        title={translate('modals.appUpdatePrompt.update')}
                        onPress={() => onClose('update')}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default AppUpdatePromptModal;
