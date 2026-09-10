import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { getTheme, ITherrThemeColors } from '../../styles/themes';
import { fontSizes, fontWeights } from '../../styles/text';
import { therrFontFamily } from '../../styles/font';
import { space } from '../../styles/layouts/spacing';
import { radius } from '../../styles/radii';
import BaseModal from './BaseModal';
import ModalButton from './ModalButton';

const MAX_MESSAGE_LENGTH = 255;

interface IRepostModalProps {
    isVisible: boolean;
    isSubmitting?: boolean;
    onCancel: () => void;
    /**
     * Receives the (trimmed) quote text. An empty string is a plain repost — the caller sends
     * it as the new thought's message either way, so this never has to distinguish the two.
     */
    onConfirm: (message: string) => void;
    /** The thought being reposted; its message is previewed so the user sees what they share. */
    thought: any;
    translate: Function;
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

/**
 * Composer for a repost. The quote is optional by design: the fast path (open, confirm) is a
 * plain repost, and typing turns the same action into a quote repost without a second control.
 */
const RepostModal = ({
    isVisible,
    isSubmitting,
    onCancel,
    onConfirm,
    thought,
    translate,
    themeButtons,
}: IRepostModalProps) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);
    const [message, setMessage] = useState('');

    // The modal stays mounted between openings, so without this the previous quote would be
    // pre-filled the next time any thought is reposted.
    useEffect(() => {
        if (isVisible) {
            setMessage('');
        }
    }, [isVisible]);

    return (
        <BaseModal
            isVisible={isVisible}
            onDismiss={onCancel}
            headerText={translate('modals.repostModal.header')}
            dismissable={!isSubmitting}
            actions={
                <>
                    <ModalButton
                        iconName="close"
                        title={translate('modals.repostModal.cancel')}
                        onPress={onCancel}
                        disabled={isSubmitting}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="check"
                        title={translate('modals.repostModal.confirm')}
                        onPress={() => onConfirm(message.trim())}
                        loading={isSubmitting}
                        disabled={isSubmitting}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </>
            }
        >
            <PaperTextInput
                mode="outlined"
                placeholder={translate('modals.repostModal.placeholder')}
                value={message}
                onChangeText={setMessage}
                maxLength={MAX_MESSAGE_LENGTH}
                multiline
                numberOfLines={3}
                disabled={isSubmitting}
                style={localStyles.input}
                outlineStyle={localStyles.inputOutline}
            />
            <Text style={[localStyles.counterText, { color: therrTheme.colors.onSurfaceMuted }]}>
                {`${message.length}/${MAX_MESSAGE_LENGTH}`}
            </Text>
            <View style={[
                localStyles.previewContainer,
                { borderColor: therrTheme.colors.accentDivider },
            ]}>
                <Text
                    style={[localStyles.previewUserName, { color: therrTheme.colors.onSurface }]}
                    numberOfLines={1}
                >
                    {thought?.fromUserName || ''}
                </Text>
                <Text
                    style={[localStyles.previewMessage, { color: therrTheme.colors.onSurface }]}
                    numberOfLines={4}
                >
                    {thought?.message || ''}
                </Text>
            </View>
        </BaseModal>
    );
};

const localStyles = StyleSheet.create({
    input: {
        backgroundColor: 'transparent',
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
    },
    inputOutline: {
        borderRadius: radius.md,
    },
    counterText: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.xs,
        textAlign: 'right',
        paddingTop: space.xs,
    },
    previewContainer: {
        marginTop: space.sm,
        padding: space.sm,
        borderWidth: 1,
        borderRadius: radius.md,
    },
    previewUserName: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        paddingBottom: space.xs,
    },
    previewMessage: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.sm,
    },
});

export default RepostModal;
