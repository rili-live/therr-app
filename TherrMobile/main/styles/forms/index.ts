import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { containerStyles, containerTightStyles, inputStyle, getTextInputStyle } from './base';
import { getTheme, ITherrTheme } from '../themes';

const getInputContainerBaseStyles = (theme: ITherrTheme): any => ({
    borderBottomColor: theme.colors.textDarkGray,
    borderBottomWidth: 1,
});

const platformSpecificInputStyles = Platform.OS !== 'ios' ? {
    backgroundColor: 'rgba(255,255,255,.15)', // colors.teriary with 70% opacity
    color: 'black',
} : {
    backgroundColor: 'rgba(255,255,255,.1)', // colors.teriary with 70% opacity
    color: 'black',
};

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
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
        },
        placeholderText: {
            fontWeight: '600',
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
            color: 'rgba(255,255,255,.58)',
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
            ...platformSpecificInputStyles,
            paddingLeft: 10,
            paddingRight: 10,
            borderRadius: 15,
            elevation: 0,
            borderBottomWidth: 0,
            height: 59,
            paddingHorizontal: 0,
        },
        inputLabelLight: {
            paddingHorizontal: 2,
            fontSize: 14,
            color: therrTheme.colors.accentTextWhite,
        },
        inputLabelDark: {
            paddingHorizontal: 2,
            fontSize: 14,
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
        button: {
            backgroundColor: therrTheme.colors.primary3,
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
        buttonTitle: {
            fontWeight: '500',
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
        },
        buttonTitleDisabled: {
            color: therrTheme.colors.textGray,
        },
        buttonIcon: {
            color: therrTheme.colors.textWhite,
            marginRight: 10,
            marginLeft: 10,
        },
        buttonPill: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0,
            paddingHorizontal: 10,
            borderRadius: 20,
            height: 26,
            backgroundColor: therrTheme.colors.accentTeal,
        },
        buttonPillIcon: {
            marginLeft: 8,
        },
        buttonPillContainer: {
            padding: 0,
            margin: 0,
            borderRadius: 20,
            height: 26,
            marginHorizontal: 4,
            marginTop: 14,
        },
        buttonPillTitle: {
            lineHeight: 26,
            paddingTop: 0,
            color: therrTheme.colors.accentTextBlack,
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
