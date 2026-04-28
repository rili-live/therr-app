import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { getTheme, ITherrThemeColors } from '../../styles/themes';
import { fontSizes, fontWeights } from '../../styles/text';
import { therrFontFamily } from '../../styles/font';
import { space } from '../../styles/layouts/spacing';
import BaseModal from './BaseModal';
import ModalButton from './ModalButton';

interface IConfirmModal {
    headerText?: string;
    isConfirming?: boolean;
    isVisible: boolean;
    onCancel: any;
    onConfirm: any;
    renderImage?: () => React.ReactNode,
    text: string;
    text2?: string;
    textConfirm?: string;
    textCancel?: string;
    translate: Function;
    width?: string;
    /**
     * @deprecated No longer used internally. ConfirmModal now pulls its theme
     * from Redux via BaseModal. The prop is accepted to keep ~17 existing call
     * sites working without changes; remove once those are migrated.
     */
    theme?: {
        colors: ITherrThemeColors;
        styles: any;
    };
    /**
     * @deprecated Same as `theme` above.
     */
    themeModal?: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

export default ({
    headerText,
    isConfirming,
    isVisible,
    onCancel,
    onConfirm,
    renderImage,
    text,
    text2,
    textConfirm,
    textCancel,
    themeButtons,
    translate,
    width,
}: IConfirmModal) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);

    // When there's no header, the body text becomes the prompt's emphasis,
    // so it renders larger and heavier (mirrors the prior bodyTextBold path).
    const showEmphasis = !headerText;

    return (
        <BaseModal
            isVisible={isVisible}
            onDismiss={onCancel}
            headerText={headerText}
            width={width}
            actions={
                <>
                    <ModalButton
                        iconName="close"
                        title={textCancel || translate('modals.confirmModal.cancel')}
                        onPress={onCancel}
                        disabled={isConfirming}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="check"
                        title={textConfirm || translate('modals.confirmModal.confirm')}
                        onPress={onConfirm}
                        loading={isConfirming}
                        disabled={isConfirming}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </>
            }
        >
            {renderImage ? renderImage() : null}
            <Text style={[
                localStyles.bodyText,
                { color: therrTheme.colors.textWhite },
                showEmphasis && localStyles.bodyTextEmphasized,
            ]}>
                {text}
            </Text>
            {text2 ? (
                <Text style={[localStyles.bodyText, { color: therrTheme.colors.textWhite }]}>
                    {text2}
                </Text>
            ) : null}
        </BaseModal>
    );
};

const localStyles = StyleSheet.create({
    bodyText: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
        textAlign: 'center',
        paddingVertical: space.xs,
        paddingHorizontal: space.md,
    },
    bodyTextEmphasized: {
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.semibold,
        paddingTop: space.md,
        paddingBottom: space.lg,
    },
});
