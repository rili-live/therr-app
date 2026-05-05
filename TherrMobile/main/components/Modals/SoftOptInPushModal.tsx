import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { getTheme, ITherrThemeColors } from '../../styles/themes';
import { fontSizes, fontWeights } from '../../styles/text';
import { therrFontFamily } from '../../styles/font';
import { space } from '../../styles/layouts/spacing';
import BaseModal from './BaseModal';
import ModalButton from './ModalButton';

interface ISoftOptInPushModalProps {
    isVisible: boolean;
    onEnable: () => void;
    onDefer: () => void;
    titleKey?: string;
    bodyKey?: string;
    translate: (key: string, params?: any) => string;
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

// In-app explainer shown before triggering the OS push-permission prompt.
// Anchoring the ask to a meaningful action (e.g. pact creation on HABITS) lifts
// opt-in from the iOS default ~50% to 70-80%. See
// docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md item #1.
export default ({
    isVisible,
    onEnable,
    onDefer,
    titleKey,
    bodyKey,
    translate,
    themeButtons,
}: ISoftOptInPushModalProps) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);

    const headerText = translate(titleKey || 'components.softOptInPush.title');
    const bodyText = translate(bodyKey || 'components.softOptInPush.bodyDefault');

    return (
        <BaseModal
            isVisible={isVisible}
            onDismiss={onDefer}
            headerText={headerText}
            actions={
                <>
                    <ModalButton
                        iconName="close"
                        title={translate('components.softOptInPush.notNow')}
                        onPress={onDefer}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="check"
                        title={translate('components.softOptInPush.enable')}
                        onPress={onEnable}
                        iconRight
                        themeButtons={themeButtons}
                    />
                </>
            }
        >
            <Text style={[localStyles.bodyText, { color: therrTheme.colors.onSurface }]}>
                {bodyText}
            </Text>
        </BaseModal>
    );
};

const localStyles = StyleSheet.create({
    bodyText: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
        textAlign: 'center',
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
    },
});
