import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

const containerStyles: any = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: 8,
    zIndex: -1,
};

const textStyles: any = {
    color: therrTheme.colors.textBlack,
    marginVertical: 50,
    paddingHorizontal: 10,
    fontSize: 20,
    textAlign: 'center',
};

export default StyleSheet.create({
    // container styles
    defaultContainer: {
        ...containerStyles,
    },
    therrBlackRollingContainer: {
        ...containerStyles,
        marginHorizontal: '35%',
    },
    yellowCarContainer: {
        ...containerStyles,
    },

    // test styles
    defaultText: {
        ...textStyles,
    },
    therrBlackRollingText: {
        ...textStyles,
        color: therrTheme.colorVariations.textWhiteFade,
    },
    yellowCarText: {
        ...textStyles,
    },
});
