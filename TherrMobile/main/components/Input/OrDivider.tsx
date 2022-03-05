import React from 'react';
import { View, Text } from 'react-native';

interface IOrDividerProps {
    translate: Function;
    themeForms: {
        styles: any;
    };
    containerStyle?: any;
}

export default ({
    translate,
    themeForms,
    containerStyle,
}: IOrDividerProps) => (
    <View style={[themeForms.styles.orDividerContainer, containerStyle]}>
        <View style={themeForms.styles.orDividerLines}></View>
        <Text style={themeForms.styles.orDividerText}>{translate('forms.dividerOr')}</Text>
        <View style={themeForms.styles.orDividerLines}></View>
    </View>
);
