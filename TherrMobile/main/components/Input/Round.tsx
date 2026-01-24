import React from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import BaseInput from './';

export class RoundInput extends BaseInput {
    constructor(props) {
        super(props);
    }
    render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { themeForms, value, ref: _ref, ...restProps } = this.props as any;

        return (
            <BaseInput
                containerStyle={themeForms.styles.containerRound}
                style={ !value?.length ? themeForms.styles.placeholderText : themeForms.styles.inputText }
                placeholderTextColor={themeForms.styles.placeholderText.color}
                inputContainerStyle={themeForms.styles.inputContainerRound}
                {...restProps}
                themeForms={themeForms}
                inputStyle={[(Platform.OS !== 'ios' ? themeForms.styles.input : themeForms.styles.inputAlt), this.props.inputStyle]}
            />
        );
    }
}

export default RoundInput;
