import React from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import BaseInput from './';

export class RoundInput extends BaseInput {
    constructor(props) {
        super(props);
    }
    render() {
        const { themeForms } = this.props;

        return (
            <BaseInput
                inputStyle={Platform.OS !== 'ios' ? themeForms.styles.input : themeForms.styles.inputAlt}
                inputContainerStyle={themeForms.styles.inputContainerRound}
                {...this.props}
            />
        );
    }
}

export default RoundInput;
