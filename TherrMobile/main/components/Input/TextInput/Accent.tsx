import React from 'react';
import 'react-native-gesture-handler';
import BaseTextInput from '.';
import formStyles from '../../../styles/forms';
import * as therrTheme from '../../../styles/themes';

export class AccentTextInput extends BaseTextInput {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <BaseTextInput
                style={formStyles.textInputAccent}
                placeholderTextColor={therrTheme.colors.placeholderTextColor}
                selectionColor={therrTheme.colors.accentYellow}
                multiline={true}
                {...this.props}
            />
        );
    }
}

export default AccentTextInput;
