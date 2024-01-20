import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { containerStyles, containerTightStyles, inputStyle, getTextInputStyle } from './base';
import { getTheme, ITherrTheme } from '../themes';
import { therrFontFamily } from '../font';

const getInputContainerBaseStyles = (theme: ITherrTheme): any => ({
    borderBottomColor: theme.colors.textDarkGray,
    borderBottomWidth: 1,
});

const getPlatformSpecificInputStyles =  (theme: ITherrTheme): any => Platform.OS !== 'ios' ? {
    backgroundColor: theme.colors.inputBackgroundAndroid, // colors.teriary with 70% opacity
    color: 'black',
} : {
    backgroundColor: theme.colors.inputBackgroundIOS, // colors.teriary with 70% opacity
    color: 'black',
};

const inputLabelStyles: any = {
    paddingHorizontal: 2,
    fontSize: 14,
};

const buttonPillStyles: any = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    paddingHorizontal: 9,
    borderRadius: 20,
    height: 22,
    borderWidth: 1,
};

const buttonPillTitleStyles: any = {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    paddingTop: 0,
};

const backButtonDimension = 42;

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        input: {
            ...inputStyle,
            color: therrTheme.colors.textWhite,
        },
        inputAlt: {
            ...inputStyle,
            // color: therrTheme.colors.textBlack,
            color: therrTheme.colors.textWhite,
        },
        inputAccent: {
            ...inputStyle,
            backgroundColor: therrTheme.colors.accent2,
            color: therrTheme.colors.accentTextBlack,
            borderColor: therrTheme.colors.accentTextBlack,
            borderWidth: 1,
        },
        inputText: {
            fontWeight: '600',
            fontFamily: therrFontFamily,
        },
        placeholderText: {
            fontWeight: '600',
            fontFamily: therrFontFamily,
            color: therrTheme.colors.placeholderTextColorAlt,
        },
        ratingContainer: {
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            justifyContent: 'center',
        },
        switchContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        switchLabel: {
            fontSize: 15,
            color: therrTheme.colors.textWhite,
        },
        switchSubContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
        },
        switchButton: {
            marginRight: 10,
        },
        textField: {
            padding: inputStyle.padding,
            paddingTop: 0,
            paddingHorizontal: inputStyle.padding + 6,
        },
        textFieldInfoTextHeader: {
            fontWeight: 'bold',
            paddingBottom: 4,
            color: therrTheme.colors.textWhite,
        },
        textFieldInfoText: {
            color: therrTheme.colors.textWhite,
            letterSpacing: 0.5,
        },
        textInputAccent: {
            ...getTextInputStyle(therrTheme),
            backgroundColor: therrTheme.colors.accent2,
            color: therrTheme.colors.accentTextBlack,
            borderColor: therrTheme.colors.accentTextBlack,
            borderWidth: 1,
            borderRadius: 0,
            minHeight: 80,
        },
        textInputRound: {
            ...getTextInputStyle(therrTheme),
            ...getInputContainerBaseStyles(therrTheme),
            ...getPlatformSpecificInputStyles(therrTheme),
            color: therrTheme.colors.textWhite,
            fontFamily: therrFontFamily,
            padding: 20,
            paddingTop: 20,
            borderRadius: 15,
            elevation: 0,
            borderBottomWidth: 0,
            marginLeft: 0,
            marginRight: 0,
            borderWidth: 0,
            fontWeight: '600',
        },
        phoneInput: {
            ...inputStyle,
            color: therrTheme.colors.textWhite,
            flex: 1,
            padding: 0,
            paddingBottom: 20,
            marginRight: 10,
        },
        containerRound: {
            paddingHorizontal: 0,
        },
        inputContainerSquare: {
            ...getInputContainerBaseStyles(therrTheme),
        },
        inputContainerRound: {
            ...getInputContainerBaseStyles(therrTheme),
            ...getPlatformSpecificInputStyles(therrTheme),
            paddingLeft: 10,
            paddingRight: 10,
            borderRadius: 15,
            elevation: 0,
            borderBottomWidth: 0,
            height: 59,
            paddingHorizontal: 0,
        },
        inputLabelLight: {
            ...inputLabelStyles,
            color: therrTheme.colors.accentTextWhite,
        },
        inputLabelLightFaded: {
            ...inputLabelStyles,
            color: therrTheme.colorVariations.accentTextWhiteFade,
        },
        inputLabelDark: {
            ...inputLabelStyles,
            color: therrTheme.colors.accentTextBlack,
        },
        inputSliderContainer: {
            ...containerStyles,
        },
        inputSliderContainerTight: {
            ...containerStyles,
            ...containerTightStyles,
        },
        icon: {
            marginHorizontal: 5,
        },
        picker: {
            height: 50,
            width: '100%',
            color: therrTheme.colors.textWhite,
        },
        pickerFlex: {
            flex: 1,
            height: 50,
            color: therrTheme.colors.textWhite,
            width: '100%',
            marginBottom: 10,
        },
        pickerItem: {
            height: 50,
            color: therrTheme.colors.textWhite,
        },
        phoneInputText: {
            ...getInputContainerBaseStyles(therrTheme),
            color: therrTheme.colors.textWhite,
            fontSize: 19,
            padding: 10,
        },
        textInput: {
            ...getTextInputStyle(therrTheme),
            color: therrTheme.colors.textWhite,
        },
        textInputAlt: {
            ...getTextInputStyle(therrTheme),
            color: therrTheme.colors.textBlack,
        },
        backButton: {
            // borderRadius: 50,
            backgroundColor: therrTheme.colors.accent1,
            height: backButtonDimension,
            width: backButtonDimension,
        },
        leftButtonContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            left: 20,
            bottom: 20,
            elevation: 3,
            borderRadius: backButtonDimension / 2,
        },
        rightButtonContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            right: 20,
            bottom: 20,
            elevation: 3,
            borderRadius: backButtonDimension / 2,
        },
        button: {
            backgroundColor: therrTheme.colors.primary3,
        },
        buttonContainer: {
            ...containerStyles,
        },
        buttonPrimary: {
            backgroundColor: therrTheme.colors.primary3,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 15,
            height: 59,
        },
        buttonPrimarySmall: {
            backgroundColor: therrTheme.colors.primary3,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 8,
            height: 42,
        },
        buttonLink: {
            color: themeName === 'retro' ? therrTheme.colors.textWhite : therrTheme.colors.primary4,
            fontFamily: therrFontFamily,
        },
        buttonLinkHeader: {
            color: themeName === 'retro' ? therrTheme.colors.textWhite : therrTheme.colors.primary3,
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '600',
        },
        buttonLinkHeaderContainer: {
            paddingBottom: 3,
        },
        buttonRound: {
            backgroundColor: therrTheme.colors.primary4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 15,
            height: 59,
        },
        buttonRoundAlt: {
            backgroundColor: therrTheme.colors.backgroundWhite,
            borderColor: therrTheme.colors.primary3,
            borderWidth: 2,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 15,
            height: 59,
        },
        buttonRoundAltSmall: {
            backgroundColor: therrTheme.colors.backgroundWhite,
            borderColor: therrTheme.colors.primary3,
            borderWidth: 2,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 8,
            height: 42,
        },
        buttonRoundAltSmallWidth: {
            width: 42,
        },
        buttonWarning: {
            backgroundColor: therrTheme.colors.ternary2,
        },
        buttonWarningTitle: {
            color: therrTheme.colors.primary3,
        },
        buttonDisabled: {
            backgroundColor: therrTheme.colorVariations.primary3Fade,
        },
        buttonRoundDisabled: {
            backgroundColor: therrTheme.colorVariations.primary4Fade,
        },
        buttonTitle: {
            fontSize: 18,
            fontWeight: '500',
            fontFamily: therrFontFamily,
        },
        buttonTitleSmall: {
            fontSize: 14,
            fontWeight: '500',
            fontFamily: therrFontFamily,
        },
        buttonTitleAlt: {
            fontWeight: '500',
            fontFamily: therrFontFamily,
            color: therrTheme.colors.primary3,
        },
        buttonTitleDisabled: {
            color: therrTheme.colors.textGray,
        },
        buttonIcon: {
            color: therrTheme.colors.brandingWhite,
            marginRight: 10,
            marginLeft: 10,
        },
        buttonIconAlt: {
            color: therrTheme.colors.primary3,
            marginRight: 10,
            marginLeft: 10,
        },
        buttonIconSmall: {
            color: therrTheme.colors.brandingWhite,
            marginRight: 6,
            marginLeft: 6,
        },
        buttonIconAltSmall: {
            color: therrTheme.colors.primary3,
            marginRight: 6,
            marginLeft: 6,
        },
        buttonPill: {
            ...buttonPillStyles,
            borderColor: therrTheme.colors.brandingBlueGreen,
            backgroundColor: therrTheme.colors.brandingWhite,
        },
        buttonPillInvert: {
            ...buttonPillStyles,
            backgroundColor: therrTheme.colors.brandingBlueGreen,
            borderColor: therrTheme.colors.brandingWhite,
        },
        buttonPillIcon: {
            marginLeft: 8,
            color: therrTheme.colors.brandingBlueGreen,
        },
        buttonPillContainer: {
            padding: 0,
            margin: 0,
            borderRadius: 20,
            height: 24,
            marginHorizontal: 4,
            marginTop: 14,
        },
        buttonPillTitle: {
            ...buttonPillTitleStyles,
            color: therrTheme.colors.brandingBlueGreen,
        },
        buttonPillTitleInvert: {
            ...buttonPillTitleStyles,
            color: therrTheme.colors.brandingWhite,
        },
        orDividerContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
        },
        orDividerText: {
            color: therrTheme.colors.textGray,
            fontFamily: therrFontFamily,
            marginHorizontal: 12,
            fontSize: 18,
            fontWeight: '600',
        },
        orDividerLines: {
            flexGrow: 1,
            borderBottomWidth: 1,
            borderBottomColor: therrTheme.colors.textGray,
        },
        userImage: {
            height: 200,
            width: 200,
            borderRadius: 100,
        },
        userImageIconOverlay: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: therrTheme.colorVariations.backgroundBlackFade,
            borderRadius: 40,
            padding: 14,
        },
        userImagePressableContainer: {
            position: 'relative',
        },

        // SSO Buttons
        googleButtonContainer: {},
        googleButton: {
            backgroundColor: therrTheme.colors.brandingWhite, // Google styles color
            flex: 1,
            alignItems: 'center',
            borderColor: therrTheme.colors.brandingBlueGreen,
            borderWidth: 2,
            borderRadius: 15,
            height: 59,
            width: '100%',
            fontSize: 18,

        },
        googleButtonTitle: {
            fontFamily: therrFontFamily,
            color: therrTheme.colors.brandingBlueGreen, // Google styles color
            fontSize: 18,
            paddingLeft: 12,
            paddingRight: 12,
            fontWeight: '500',
        },
        googleButtonIcon: {
            height: 26,
            width: 26,
            padding: 8,
            marginLeft: 12,
        },
        appleButtonContainer: {
            width: '100%', // You must specify a width
            borderWidth: themeName === 'retro' ? 0 : 2,
            borderRadius: themeName === 'retro' ? 0 : 15,
            height: 52,
            elevation: 3,
        },
        appleTitleStyle: {
        },
        appleButtonIcon: {
            height: 22,
            width: 18,
            padding: 8,
        },
        headerInputBadgeContainer: {
            position: 'absolute',
            right: 0,
        },
        headerInputBadge: {
            backgroundColor: therrTheme.colors.tertiary,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
