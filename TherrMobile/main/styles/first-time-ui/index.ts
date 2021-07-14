import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

const titleStyles: any = {
    color: therrTheme.colors.textWhite,
    fontSize: 28,
    marginTop: 6,
    marginBottom: 18,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 2,
};

const createProfileGraphicStyles: any = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: 8,
    zIndex: -1,
};

export default StyleSheet.create({
    title: {
        ...titleStyles,
    },
    titleWithSpacing: {
        ...titleStyles,
        paddingBottom: 20,
    },
    formAGraphic: {
        ...createProfileGraphicStyles,
    },
    formBGraphic: {
        ...createProfileGraphicStyles,
    },
});
