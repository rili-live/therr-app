import React from 'react';
import 'react-native-gesture-handler';
import BaseTextInput from '.';
import formStyles from '../../styles/forms';
import * as therrTheme from '../../styles/themes';

export class BeemoInput extends BaseTextInput {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <BaseTextInput
                style={formStyles.textInputBeemo}
                placeholderTextColor={therrTheme.colors.placeholderTextColor}
                selectionColor={therrTheme.colors.beemoYellow}
                multiline={true}
                {...this.props}
            />
        );
    }
}

export default BeemoInput;
