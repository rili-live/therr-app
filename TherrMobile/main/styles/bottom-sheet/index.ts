import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

export const botSheetScrollViewHeight = 180;
export const botSheetScrollViewPad = 10;


const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        backgroundStyle: {
            borderRadius: 9,
        },
        contentContainer: {
            flex: 1,
            alignItems: 'center',
        },
        scrollViewOuterContainer: {
            height: botSheetScrollViewHeight + 10,
            position: 'absolute',
            width: '100%',
            bottom: 10,
        },
        scrollViewContainer: {
            height: botSheetScrollViewHeight,
        },
        scrollView: {
            width: '100%',
            height: botSheetScrollViewHeight,
            paddingVertical: botSheetScrollViewPad,
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
