import React from 'react';
import RoundInput from '../../components/Input/Round';

interface IInputGroupName {
    autoFocus: boolean;
    onChangeText: any;
    placeholder?: string;
    themeForms: {
        colors: any;
        styles: any;
    };
    translate: any;
    value?: string | undefined;
}

const InputGroupName = ({
    autoFocus,
    onChangeText,
    placeholder,
    themeForms,
    translate,
    value,
}: IInputGroupName) => {
    return (
        <RoundInput
            autoFocus={autoFocus}
            maxLength={100}
            placeholder={placeholder || translate(
                'forms.editGroup.placeholders.title'
            )}
            value={value}
            onChangeText={onChangeText}
            themeForms={themeForms}
        />
    );
};

export default InputGroupName;
