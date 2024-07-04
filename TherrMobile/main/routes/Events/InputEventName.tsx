import React from 'react';
import RoundInput from '../../components/Input/Round';


const InputEventName = ({
    autoFocus = false,
    onChangeText,
    themeForms,
    translate,
    value,
}) => {
    return (
        <RoundInput
            autoFocus={autoFocus}
            maxLength={100}
            placeholder={translate(
                'forms.editEvent.labels.notificationMsg'
            )}
            value={value}
            onChangeText={onChangeText}
            themeForms={themeForms}
        />
    );
};

export default InputEventName;
