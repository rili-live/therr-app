import React from 'react';
import { StyleSheet } from 'react-native';
import { BaseToast, ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import {
    ALERT_INFO,
    ALERT_SUCCESS,
    ALERT_WARNING,
    ALERT_ERROR,
} from '../styles/themes/brandConstants';
import { therrFontFamily } from '../styles/font';

// Enough for every translated title/message we show today; anything longer is ellipsized
// rather than clipped mid-line.
export const TOAST_TEXT1_MAX_LINES = 2;
export const TOAST_TEXT2_MAX_LINES = 4;
export const TOAST_MIN_HEIGHT = 60;

/**
 * react-native-toast-message's `BaseToast` hard-codes `height: 60` and `width: 340`. That fits
 * its own 12/10px single-line defaults, not our 17/14px text with multi-line bodies — so a
 * second line of text2 (or a larger system font scale) spilled out below the card. The toast
 * now grows with its content: `height: 'auto'` overrides the fixed height, `minHeight` keeps
 * short toasts at the library's size, and the width shrinks on narrow screens instead of
 * overflowing them.
 */
const toastStyles = StyleSheet.create({
    container: {
        height: 'auto',
        minHeight: TOAST_MIN_HEIGHT,
        width: '92%',
        maxWidth: 360,
    },
    contentContainer: {
        paddingHorizontal: 18,
        paddingVertical: 10,
    },
    text1: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: '600',
        fontFamily: therrFontFamily,
    },
    text2: {
        fontSize: 14,
        lineHeight: 19,
        fontFamily: therrFontFamily,
    },
    infoBorder: { borderLeftColor: ALERT_INFO },
    successBorder: { borderLeftColor: ALERT_SUCCESS },
    warnBorder: { borderLeftColor: ALERT_WARNING },
    errorBorder: { borderLeftColor: ALERT_ERROR },
});

// Every type renders the same auto-sizing card; only the accent differs. `props.extraStyle`
// and the icon renderers are forwarded from `Toast.show({ props })` for any type.
const renderToast = (borderStyle) => (params: ToastConfigParams<any>) => (
    <BaseToast
        {...params}
        style={[toastStyles.container, borderStyle, params?.props?.extraStyle]}
        contentContainerStyle={toastStyles.contentContainer}
        text1Style={toastStyles.text1}
        text2Style={toastStyles.text2}
        text1NumberOfLines={TOAST_TEXT1_MAX_LINES}
        text2NumberOfLines={TOAST_TEXT2_MAX_LINES}
        renderLeadingIcon={params?.props?.renderLeadingIcon}
        renderTrailingIcon={params?.props?.renderTrailingIcon}
    />
);

// The `*Big` types predate auto-sizing, when a text2 needed a taller fixed-height variant.
// They are kept because `showToast` and direct `Toast.show` callers still name them.
const toastConfig: ToastConfig = {
    info: renderToast(toastStyles.infoBorder),
    success: renderToast(toastStyles.successBorder),
    successBig: renderToast(toastStyles.successBorder),
    warn: renderToast(toastStyles.warnBorder),
    warnBig: renderToast(toastStyles.warnBorder),
    notifyPublic: renderToast(toastStyles.infoBorder),
    error: renderToast(toastStyles.errorBorder),
    errorBig: renderToast(toastStyles.errorBorder),
};

export default toastConfig;
