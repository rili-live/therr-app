import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from './';

export class AccentInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        const { themeForms } = this.props;

        return (
            <BaseInput
                inputStyle={themeForms.styles.inputAccent}
                selectionColor={themeForms.colors.accentYellow}
                {...this.props}
            />
        );
    }
}

export default AccentInput;
