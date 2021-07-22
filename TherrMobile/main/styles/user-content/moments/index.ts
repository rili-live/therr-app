import { Platform, StyleSheet } from 'react-native';
import * as therrTheme from '../../themes';
import editing from './editing';
import viewing, { getViewingMomentStyles } from './viewing';

const dividerHeight = 10;

const momentTextStyles: any = {
    color: therrTheme.colors.textBlack,
};

const androidMomentContainerStyles: any = {

};

const iosMomentContainerStyles: any = {

};

export default StyleSheet.create({
    divider: {
        backgroundColor: therrTheme.colorVariations.primary2Darken,
        height: dividerHeight * 2,
        width: '100%',
    },
    momentCarousel: {
        backgroundColor: therrTheme.colorVariations.primary2Darken,
    },
    momentContainer: {
        flex: 1,
        overflow: 'hidden',
        paddingBottom: 10,
        backgroundColor: therrTheme.colors.primary2,
        marginBottom: dividerHeight,
        ...(Platform.OS === 'ios' ? iosMomentContainerStyles : androidMomentContainerStyles),
    },
    momentTitle: {
        ...momentTextStyles,
        fontSize: 30,
    },
    momentMessageText: {
        ...momentTextStyles,
        fontSize: 20,
        overflow: 'hidden',
    },
    momentDetailsText: {
        ...momentTextStyles,
        fontSize: 14,
    },
    noMomentsFoundText: {
        ...momentTextStyles,
        marginTop: 20,
        paddingHorizontal: 10,
        fontSize: 16,
        textAlign: 'center',
    },
});

export {
    editing,
    viewing,
    getViewingMomentStyles,
};
