import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSelector } from 'react-redux';
import AnimatedLottieView from 'lottie-react-native';
import { getTheme, ITherrThemeColors } from '../../styles/themes';
import { fontSizes, fontWeights } from '../../styles/text';
import { therrFontFamily } from '../../styles/font';
import { space } from '../../styles/layouts/spacing';
import BaseModal from './BaseModal';
import ModalButton from './ModalButton';

import shareAMoment from '../../assets/coin-wallet.json';

interface IInfoModal {
    isVisible: boolean;
    onRequestClose: any;
    translate: Function;
    themeButtons: {
        colors?: ITherrThemeColors;
        styles: any;
    };
    /**
     * @deprecated No longer used internally. InfoModal now pulls its theme
     * from Redux via BaseModal. Kept on the prop type so existing call sites
     * compile without changes.
     */
    themeModal?: {
        styles: any;
    };
}

export default ({
    isVisible,
    onRequestClose,
    themeButtons,
    translate,
}: IInfoModal) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);

    return (
        <BaseModal
            isVisible={isVisible}
            onDismiss={onRequestClose}
            actions={
                <ModalButton
                    iconName="check"
                    title={translate('modals.infoModalPoints.done')}
                    onPress={onRequestClose}
                    iconRight
                    themeButtons={themeButtons}
                />
            }
        >
            <AnimatedLottieView
                source={shareAMoment}
                resizeMode="contain"
                speed={1}
                autoPlay={true}
                loop
                style={localStyles.graphic}
            />
            <Text style={[localStyles.header, { color: therrTheme.colors.textWhite }]}>
                {translate('modals.infoModalPoints.header')}
            </Text>
            <Text style={[localStyles.text, { color: therrTheme.colors.textWhite }]}>
                {translate('modals.infoModalPoints.description')}
            </Text>
        </BaseModal>
    );
};

const localStyles = StyleSheet.create({
    graphic: {
        height: 150,
        width: 150,
        alignSelf: 'center',
        marginBottom: space.lg,
    },
    header: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.semibold,
        textAlign: 'center',
        paddingTop: space.md,
        paddingBottom: space.sm,
    },
    text: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
        textAlign: 'center',
        paddingHorizontal: space.sm,
        paddingBottom: space.md,
    },
});
