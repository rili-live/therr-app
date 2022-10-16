import React from 'react';
import 'react-native-gesture-handler';
import BaseTextInput from './';

export class AccentTextInput extends BaseTextInput {
    constructor(props) {
        super(props);
    }

    render() {
        const { themeForms } = this.props;

        return (
            <BaseTextInput
                style={themeForms.styles.textInputAccent}
                placeholderTextColor={themeForms.colors.placeholderTextColor}
                selectionColor={themeForms.colors.accentYellow}
                multiline={true}
                {...this.props}
            />
        );
    }
}

export default AccentTextInput;
