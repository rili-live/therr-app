import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from '.';
import formStyles from '../../styles/forms';

export class RoundInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <BaseInput
                inputContainerStyle={formStyles.inputContainerRound}
                {...this.props}
            />
        );
    }
}

export default RoundInput;
