import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from './';

export class SquareInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        const { themeForms, ref: _ref, ...restProps } = this.props as any;

        return (
            <BaseInput
                inputContainerStyle={themeForms.styles.inputContainerSquare}
                {...restProps}
                themeForms={themeForms}
            />
        );
    }
}

export default SquareInput;
