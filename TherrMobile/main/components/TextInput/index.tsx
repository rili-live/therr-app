import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import 'react-native-gesture-handler';
import * as therrTheme from '../../styles/themes';

export class BaseInput extends React.Component<TextInputProps> {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <TextInput
                selectionColor={therrTheme.colors.ternary}
                {...this.props}
            />
        );
    }
}

export default BaseInput;
