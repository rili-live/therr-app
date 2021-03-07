import React from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import BaseInput from './';
import formStyles from '../../styles/forms';

export class RoundInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <BaseInput
                inputStyle={Platform.OS !== 'ios' ? formStyles.input : formStyles.inputAlt}
                inputContainerStyle={formStyles.inputContainerRound}
                {...this.props}
            />
        );
    }
}

export default RoundInput;
