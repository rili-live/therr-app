import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from './';

export class AccentInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        const { themeForms, ref: _ref, ...restProps } = this.props as any;

        return (
            <BaseInput
                inputStyle={themeForms.styles.inputAccent}
                selectionColor={themeForms.colors.accentYellow}
                {...restProps}
                themeForms={themeForms}
            />
        );
    }
}

export default AccentInput;
