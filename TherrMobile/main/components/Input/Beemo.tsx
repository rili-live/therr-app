import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from '.';
import formStyles from '../../styles/forms';
import * as therrTheme from '../../styles/themes';

export class BeemoInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <BaseInput
                inputStyle={formStyles.inputBeemo}
                selectionColor={therrTheme.colors.beemoYellow}
                {...this.props}
            />
        );
    }
}

export default BeemoInput;
