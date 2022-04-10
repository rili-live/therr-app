import React from 'react';
import 'react-native-gesture-handler';
import BaseTextInput from '.';

export class RoundTextInput extends BaseTextInput {
    constructor(props) {
        super(props);
    }

    render() {
        const { minHeight, themeForms } = this.props;

        let style = themeForms.styles.textInputRound;
        if (minHeight) {
            style = [style, { minHeight }];
        }

        return (
            <BaseTextInput
                style={style}
                placeholderTextColor={themeForms.styles.placeholderText.color}
                selectionColor={themeForms.colors.accentYellow}
                multiline={true}
                {...this.props}
            />
        );
    }
}

export default RoundTextInput;
