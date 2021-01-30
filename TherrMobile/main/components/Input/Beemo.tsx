import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from '.';
import formStyles from '../../styles/forms';

export class BeemoInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <BaseInput
                inputContainerStyle={formStyles.inputContainerSquare}
                {...this.props}
            />
        );
    }
}

export default BeemoInput;
