import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import * as therrTheme from '../themes';
import { containerStyles } from './base';

export default StyleSheet.create({
    inputsContainer: {
        marginTop: 10,
    },
    button: {
        backgroundColor: therrTheme.colors.primary3,
    },
    submitButtonContainer: {
        ...containerStyles,
    },
});
