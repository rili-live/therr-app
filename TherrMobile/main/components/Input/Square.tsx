import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from './';

export class SquareInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        const { themeForms } = this.props;

        return (
            <BaseInput
                inputContainerStyle={themeForms.styles.inputContainerSquare}
                {...this.props}
            />
        );
    }
}

export default SquareInput;
