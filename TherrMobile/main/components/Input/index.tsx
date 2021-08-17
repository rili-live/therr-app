import React from 'react';
import { Input, InputProps } from 'react-native-elements';
import 'react-native-gesture-handler';
import * as therrTheme from '../../styles/themes';
import formStyles from '../../styles/forms';

export class BaseInput extends React.Component<InputProps | any, any> {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Input
                inputStyle={formStyles.input}
                rightIconContainerStyle={formStyles.icon}
                selectionColor={therrTheme.colors.ternary}
                {...this.props}
            />
        );
    }
}

export default BaseInput;
