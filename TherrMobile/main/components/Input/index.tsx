import React from 'react';
import { Input, InputProps } from 'react-native-elements';
import 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../styles/themes';

export interface IBaseInputProps {
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    }
}

export class BaseInput extends React.Component<InputProps & IBaseInputProps, any> {
    constructor(props) {
        super(props);
    }

    render() {
        const { themeForms } = this.props;

        return (
            <Input
                inputStyle={themeForms.styles.input}
                rightIconContainerStyle={themeForms.styles.icon}
                selectionColor={themeForms.colors.selectionColor}
                {...this.props}
            />
        );
    }
}

export default BaseInput;
