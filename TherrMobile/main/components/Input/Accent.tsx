import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from '.';
import formStyles from '../../styles/forms';
import * as therrTheme from '../../styles/themes';

export class AccentInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <BaseInput
                inputStyle={formStyles.inputAccent}
                selectionColor={therrTheme.colors.accentYellow}
                {...this.props}
            />
        );
    }
}

export default AccentInput;
