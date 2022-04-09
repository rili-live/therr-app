import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../../styles/themes';

export interface IBaseTextInputProps {
    minHeight?: number;
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    }
}

export class BaseInput extends React.Component<TextInputProps & IBaseTextInputProps> {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <TextInput
                selectionColor={this.props.themeForms.colors.ternary}
                {...this.props}
            />
        );
    }
}

export default BaseInput;
